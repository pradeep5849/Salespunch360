import {beforeEach,it,expect,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({bank:vi.fn(),banks:vi.fn(),opening:vi.fn(),lines:vi.fn(),transaction:vi.fn(),branch:vi.fn()}));
const tx={moneyAccount:{findFirst:m.bank},journalLine:{aggregate:m.opening,findMany:m.lines}};
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction,moneyAccount:{findMany:m.banks},branch:{findFirst:m.branch}}}));
import {runFinancialReportForActor} from "./service";
import {bankStatementOptionsForActor} from "./bank-statement";
import {formatReport} from "./display";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const bank="11111111-1111-4111-8111-111111111111",branch="22222222-2222-4222-8222-222222222222";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]} as ProjectActor;
const input={moneyAccountId:bank,from:"2026-10-01",to:"2026-10-18"};
const D=Prisma.Decimal;
const line=(id:string,debit:string,credit:string)=>({id,debit:new D(debit),credit:new D(credit),description:"Receipt",journalEntry:{entryDate:new Date("2026-10-18"),journalNumber:"J-1",narration:null,reference:null}});
beforeEach(()=>{vi.clearAllMocks();m.bank.mockResolvedValue({id:bank,name:"Bank",ledgerAccountId:"ledger"});m.banks.mockResolvedValue([{id:bank,name:"Bank"}]);m.opening.mockResolvedValue({_sum:{debit:new D(100),credit:new D(0)}});m.lines.mockResolvedValue([line("one","20","0"),line("two","0","5")]);m.transaction.mockImplementation(async work=>work(tx));m.branch.mockResolvedValue({id:branch})});
it("reconciles posted deposits and withdrawals from one repeatable read snapshot",async()=>{
 const r=await runFinancialReportForActor(actor,"bank-statement",input);expect(r.columns).toEqual(["Date","Description","Withdrawal","Deposit"]);expect(r.rows.map(x=>x.slice(2))).toEqual([["0.00","20.00"],["5.00","0.00"]]);expect(r.summary?.map(x=>x.value)).toEqual(["100.00","5.00","20.00","115.00"]);expect(m.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 expect(m.bank.mock.calls[0][0].where).toEqual({companyId:"company",type:"BANK",OR:[{branchId:null},{branchId:{in:[branch]}}],id:bank});
 expect(m.lines.mock.calls[0][0].where).toMatchObject({companyId:"company",ledgerAccountId:"ledger",journalEntry:{companyId:"company",branchId:{in:[branch]},status:{in:["POSTED","REVERSED"]},entryDate:{gte:new Date("2026-10-01"),lte:new Date("2026-10-18T23:59:59.999Z")}}});
});
it("prompts for a bank instead of merging unrelated accounts",async()=>{const r=await runFinancialReportForActor(actor,"bank-statement",{});expect(r.note).toContain("Select a bank");expect(r.rows).toEqual([]);expect(m.transaction).not.toHaveBeenCalled()});
it("denies foreign, nonbank and forbidden branch scopes before ledger reads",async()=>{
 m.bank.mockResolvedValue(null);await expect(runFinancialReportForActor(actor,"bank-statement",input)).rejects.toThrow();
 await expect(runFinancialReportForActor(actor,"bank-statement",{...input,branchId:bank})).rejects.toThrow();
 await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"bank-statement",input)).rejects.toThrow();
 await expect(runFinancialReportForActor(actor,"cash-bank",input)).rejects.toThrow("REPORT_FILTER_NOT_SUPPORTED");expect(m.lines).not.toHaveBeenCalled();expect(m.opening).not.toHaveBeenCalled();
});
it("lists only authorized company bank names, retaining inactive history",async()=>{
 expect(await bankStatementOptionsForActor(actor)).toEqual([{id:bank,name:"Bank"}]);expect(m.banks).toHaveBeenCalledWith({where:{companyId:"company",type:"BANK",OR:[{branchId:null},{branchId:{in:[branch]}}]},select:{id:true,name:true},orderBy:[{name:"asc"},{id:"asc"}]});await expect(bankStatementOptionsForActor({...actor,accountRole:"PROJECT_MANAGER"})).rejects.toThrow();
});
it("paginates statements without rounding aggregate cents",async()=>{
 m.lines.mockResolvedValueOnce(Array.from({length:1000},(_,i)=>line(String(i),"1.01","0"))).mockResolvedValueOnce([line("last","0","0.01")]);const r=await runFinancialReportForActor(actor,"bank-statement",input);expect(r.rows).toHaveLength(1001);expect(r.summary?.at(-1)?.value).toBe("1109.99");expect(m.lines.mock.calls[1][0]).toMatchObject({cursor:{id:"999"},skip:1});
});
it("formats withdrawals/deposits using business currency without changing numeric exports",async()=>{
 const r=await runFinancialReportForActor(actor,"bank-statement",input);expect(formatReport(r,{...DEFAULT_DISPLAY_PREFERENCES,baseCurrency:"USD"}).rows[0][3]).toContain("$");expect(formatReport(r,DEFAULT_DISPLAY_PREFERENCES,true).rows[0][3]).toBe("20.00");
});
it("retains opening-only and overdrawn balances without fabricating income",async()=>{
 m.lines.mockResolvedValue([]);m.opening.mockResolvedValue({_sum:{debit:null,credit:new D("12.34")}});const r=await runFinancialReportForActor(actor,"bank-statement",input);expect(r.rows).toEqual([]);expect(r.summary?.map(x=>x.value)).toEqual(["-12.34","0.00","0.00","-12.34"]);
});
