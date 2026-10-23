import {beforeEach,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({create:vi.fn(),post:vi.fn(),receipt:vi.fn(),balance:vi.fn(),year:vi.fn(),scope:vi.fn(),tx:{marker:"same transaction"}}));
vi.mock("./commercial",()=>({createCommercialDocumentForActor:m.create,postCommercialDocumentForActor:m.post,createSettlementForActor:m.receipt,saleReceiptBalanceForActor:m.balance}));
vi.mock("./financial-year",()=>({ensureOpenFinancialYearForDate:m.year}));
vi.mock("./transaction-scope",()=>({inAccountTransaction:m.scope}));
import {submitSaleForActor} from "./sale-submit";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,branchAccessScope:"ALL_BRANCHES"} as Parameters<typeof submitSaleForActor>[0];
const input={type:"SALES_INVOICE",branchId:"branch",partyId:"customer",issueDate:"2026-10-18"};
const row={id:"saved",companyId:"company",branchId:"branch",partyId:"customer",issueDate:new Date("2026-10-18"),documentNumber:"INV-1"};
beforeEach(()=>{vi.clearAllMocks();m.scope.mockImplementation(async(_,work)=>work(m.tx));m.create.mockResolvedValue(row);m.post.mockResolvedValue({id:"journal"});m.year.mockResolvedValue({id:"year"});m.receipt.mockResolvedValue({id:"receipt"});m.balance.mockResolvedValue(new Prisma.Decimal("90.00"))});
it("posts invoice and receipt through the identical transaction and keeps stable receipt identity",async()=>{
 expect(await submitSaleForActor(actor,input,{receivedAmount:"90.00",paymentType:"CASH"})).toEqual({...row,status:"POSTED"});
 expect(m.create).toHaveBeenCalledWith(actor,input,m.tx);expect(m.year).toHaveBeenCalledWith("company",row.issueDate,m.tx);expect(m.post).toHaveBeenCalledWith(actor,{documentId:"saved"},m.tx);
 expect(m.receipt).toHaveBeenCalledWith(actor,expect.objectContaining({idempotencyKey:"sale-save-receipt:saved",amount:"90.00",branchId:"branch",partyId:"customer",allocations:[{documentId:"saved",amount:"90.00"}]}),m.tx);
});
it("a posting error rejects the encompassing transaction before any receipt",async()=>{
 m.post.mockRejectedValue(new Error("INSUFFICIENT_STOCK"));await expect(submitSaleForActor(actor,input)).rejects.toThrow("INSUFFICIENT_STOCK");expect(m.receipt).not.toHaveBeenCalled();
});
it("a receipt failure rejects the same encompassing transaction rather than confirming a partial sale",async()=>{
 m.receipt.mockRejectedValue(new Error("INVALID_BANK_ACCOUNT"));await expect(submitSaleForActor(actor,input,{receivedAmount:"10",paymentType:"BANK"})).rejects.toThrow("INVALID_BANK_ACCOUNT");expect(m.scope).toHaveBeenCalledOnce();
});
it("full payment uses exact remaining balance and preserves the native receipt retry key",async()=>{
 m.balance.mockResolvedValue(new Prisma.Decimal("90071992547409.91"));await submitSaleForActor(actor,input,{receivedInFull:true},"mobile-sale-receipt");expect(m.balance).toHaveBeenCalledWith(actor,"saved","mobile-sale-receipt:saved",m.tx);expect(m.receipt).toHaveBeenCalledWith(actor,expect.objectContaining({amount:"90071992547409.91"}),m.tx);
});
it("a zero outstanding cash sale creates no zero receipt",async()=>{
 m.balance.mockResolvedValue(new Prisma.Decimal(0));await submitSaleForActor(actor,input,{receivedInFull:true});expect(m.receipt).not.toHaveBeenCalled();
});
it("denies nonposting roles and non-sale document types before opening a transaction",async()=>{
 await expect(submitSaleForActor({...actor,accountRole:"DATA_ENTRY"},input)).rejects.toThrow();await expect(submitSaleForActor(actor,{...input,type:"SALES_ORDER"})).rejects.toThrow("INVALID_INPUT");expect(m.scope).not.toHaveBeenCalled();
});
it.each(["not money","",-1])("invalid received amount %s cannot create an invoice",async receivedAmount=>{
 await expect(submitSaleForActor(actor,input,{receivedAmount})).rejects.toThrow();expect(m.create).not.toHaveBeenCalled();
});
it("invalid cheque details cannot create or post an invoice",async()=>{
 await expect(submitSaleForActor(actor,input,{receivedAmount:"10",paymentType:"CHEQUE",chequeNumber:"",chequeDate:"bad"})).rejects.toThrow();expect(m.scope).not.toHaveBeenCalled();
});

it.each(["CASH","BANK","UPI","CARD"])("preserves the supplied %s payment reference in the same receipt transaction",async paymentType=>{await submitSaleForActor(actor,input,{receivedAmount:"10",paymentType,reference:"Saved reference / 123"});expect(m.receipt).toHaveBeenCalledWith(actor,expect.objectContaining({reference:"Saved reference / 123",paymentMode:paymentType==="CASH"?"CASH":"BANK",amount:"10.00"}),m.tx)});
it("rejects oversized reference or unknown payment type before any document transaction",async()=>{for(const payment of [{receivedAmount:"10",reference:"x".repeat(161)},{receivedAmount:"10",paymentType:"UNKNOWN"}])await expect(submitSaleForActor(actor,input,payment)).rejects.toThrow();expect(m.scope).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled()});
