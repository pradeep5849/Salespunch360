import {randomUUID} from "node:crypto";
import {PrismaClient,Prisma} from "@prisma/client";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import type {ProjectActor} from "./projects";
const url=process.env.RESTORE_TEST_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/allocated_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {createCommercialDocumentForActor,postCommercialDocumentForActor,documentOutstandingsBatch,getCommercialDocumentForActor,commercialDocumentControlsForActor} from "./commercial";
import {createAllocatedPaymentForActor} from "./allocated-payment";
import {postJournalInTx} from "@/lib/accounting/service";
import {listOpeningOutstandings} from "./opening-balances";
import {chequeFinancialActionForActor} from "./cheque-finance";
import {purchaseDuplicateDraft,purchaseReturnDraft} from "./purchase-duplicate";
const companyId=randomUUID(),branchId=randomUUID(),userId=randomUUID(),customerId=randomUUID();
const actor={id:userId,name:"Fixture",email:`${userId}@example.test`,companyId,role:"ACCOUNT_USER",isActive:true,accountRole:"ACCOUNT_ADMIN",accountAccessActive:true,salesAccessActive:false,salesRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;
const invoices:{id:string;grandTotal:Prisma.Decimal;payableAmount:Prisma.Decimal|null}[]=[];
describe.skipIf(!url)("single-cash partial payment and unused advance",()=>{
 beforeAll(async()=>{
  await client.company.create({data:{id:companyId,name:"Allocated payment fixture",slug:`allocated-${companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.user.create({data:{id:userId,companyId,name:actor.name,email:actor.email,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
  await client.branch.create({data:{id:branchId,companyId,name:"Main",code:"MAIN"}});
  await client.financialYear.create({data:{companyId,name:"FY",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await client.ledgerAccount.create({data:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem}});
  await client.customer.create({data:{id:customerId,companyId,branchId,name:"Buyer",isAccountCustomer:true}});
  for(const amount of ["100","200"]){const invoice=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-11-05",lines:[{lineType:"CUSTOM",itemName:"Service",quantity:"1",rate:amount,taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:invoice.id});invoices.push(invoice);}
 });
 afterAll(async()=>{await client.$disconnect();});
 it("records cash once, links two invoices, keeps the remainder and binds retry to the original plan",async()=>{
  const input={type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:"500",transactionDate:"2026-11-05",idempotencyKey:randomUUID(),allocations:[{documentId:invoices[0].id,amount:"50"},{documentId:invoices[1].id,amount:"100"}]};
  const before=await client.journalEntry.count({where:{companyId}});
  const payment=await createAllocatedPaymentForActor(actor,input);
  expect(payment.type).toBe("CUSTOMER_ADVANCE");expect(payment.amount.toString()).toBe("500");expect(payment.remainingAmount.toString()).toBe("350");
  expect(await client.accountSettlement.count({where:{companyId}})).toBe(1);
  expect(await client.journalEntry.count({where:{companyId}})).toBe(before+3);
  const cash=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"CASH"}});
  const lines=await client.journalLine.findMany({where:{companyId,ledgerAccountId:cash.id}});
  expect(lines).toHaveLength(1);expect(lines[0].debit.toString()).toBe("500");
  const balances=await documentOutstandingsBatch(companyId,invoices);expect(balances.get(invoices[0].id)?.toString()).toBe("50");expect(balances.get(invoices[1].id)?.toString()).toBe("100");
  expect((await createAllocatedPaymentForActor(actor,input)).id).toBe(payment.id);expect(await client.accountSettlement.count({where:{companyId}})).toBe(1);
  await expect(createAllocatedPaymentForActor(actor,{...input,allocations:[{documentId:invoices[0].id,amount:"60"}]})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  expect(await client.journalEntry.count({where:{companyId}})).toBe(before+3);
 },60000);
 it("rolls back the cash receipt if an allocation target fails authorization",async()=>{
  const before=await client.accountSettlement.count({where:{companyId}});
  await expect(createAllocatedPaymentForActor(actor,{type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:"500",transactionDate:"2026-11-05",idempotencyKey:randomUUID(),allocations:[{documentId:randomUUID(),amount:"10"}]})).rejects.toThrow();
  expect(await client.accountSettlement.count({where:{companyId}})).toBe(before);
 });
 it("partially pays opening debt once and rejects excess without leaving cash records",async()=>{
  const year=await client.financialYear.findFirstOrThrow({where:{companyId}}),ar=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"ACCOUNTS_RECEIVABLE"}}),equity=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OPENING_BALANCE_EQUITY"}});
  const journal=await client.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:year.id,branchId,entryDate:"2026-10-01",sourceType:"OPENING_BALANCE",sourceId:randomUUID(),lines:[{ledgerAccountId:ar.id,debit:"80",credit:"0"},{ledgerAccountId:equity.id,debit:"0",credit:"80"}]}));
  const opening=await client.partyOpeningBalance.create({data:{companyId,branchId,partyId:customerId,partyType:"CUSTOMER",partyName:"Buyer",effectiveDate:new Date("2026-10-01"),amount:"80",journalEntryId:journal.id,createdById:userId}});
  const input={type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:"100",transactionDate:"2026-11-05",idempotencyKey:randomUUID(),allocations:[{openingBalanceId:opening.id,amount:"30"}]};
  const payment=await createAllocatedPaymentForActor(actor,input);expect(payment.remainingAmount.toString()).toBe("70");
  const rows=await listOpeningOutstandings({companyId,partyType:"CUSTOMER",partyId:customerId,branchIds:[branchId]});expect(rows.find(x=>x.id===opening.id)?.outstanding.toString()).toBe("50");
  expect((await createAllocatedPaymentForActor(actor,input)).id).toBe(payment.id);
  const count=await client.accountSettlement.count({where:{companyId}});
  await expect(createAllocatedPaymentForActor(actor,{...input,idempotencyKey:randomUUID(),allocations:[{openingBalanceId:opening.id,amount:"60"}]})).rejects.toThrow("ALLOCATION_EXCEEDS_OUTSTANDING");
  expect(await client.accountSettlement.count({where:{companyId}})).toBe(count);
 });
 it("keeps partial cheque links pending, posts at clearance, reverses and reapplies without duplicate cash",async()=>{
  const bankLedger=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"BANK"}});
  const bank=await client.moneyAccount.create({data:{companyId,branchId,name:"Allocation bank",type:"BANK",ledgerAccountId:bankLedger.id}});
  const opening=await client.partyOpeningBalance.findFirstOrThrow({where:{companyId,partyId:customerId}});
  const before=await client.journalEntry.count({where:{companyId}});
  const input={type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CHEQUE",moneyAccountId:bank.id,chequeNumber:"PARTIAL-1",chequeDate:"2026-11-05",amount:"100",transactionDate:"2026-11-05",idempotencyKey:randomUUID(),allocations:[{documentId:invoices[0].id,amount:"20"},{openingBalanceId:opening.id,amount:"10"}]};
  const pending=await createAllocatedPaymentForActor(actor,input);expect(pending.status).toBe("PENDING_CHEQUE");expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
  const cheque=await client.cheque.findFirstOrThrow({where:{companyId,settlementId:pending.id}});
  const close={action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-11-06",moneyAccountId:bank.id};
  await chequeFinancialActionForActor(actor,cheque.id,close);
  expect((await client.accountSettlement.findUniqueOrThrow({where:{id:pending.id}})).remainingAmount.toString()).toBe("70");
  expect((await documentOutstandingsBatch(companyId,invoices)).get(invoices[0].id)?.toString()).toBe("30");
  await chequeFinancialActionForActor(actor,cheque.id,close);expect(await client.journalEntry.count({where:{companyId}})).toBe(before+3);
  await chequeFinancialActionForActor(actor,cheque.id,{action:"REOPEN",requestKey:randomUUID(),expectedVersion:1,actionDate:"2026-11-07",reason:"Recheck cheque clearance"});
  expect((await documentOutstandingsBatch(companyId,invoices)).get(invoices[0].id)?.toString()).toBe("50");
  await chequeFinancialActionForActor(actor,cheque.id,{...close,requestKey:randomUUID(),expectedVersion:2,actionDate:"2026-11-08"});
  expect((await documentOutstandingsBatch(companyId,invoices)).get(invoices[0].id)?.toString()).toBe("30");
  for(const [day,expected] of [["2026-11-05","50"],["2026-11-06","40"],["2026-11-07","50"],["2026-11-08","40"]]){
   const rows=await listOpeningOutstandings({companyId,partyType:"CUSTOMER",partyId:customerId,asOf:new Date(day)});expect(rows.find(x=>x.id===opening.id)?.outstanding.toString()).toBe(expected);
  }
  const lines=await client.journalLine.findMany({where:{companyId,ledgerAccountId:bankLedger.id}});expect(lines.reduce((n,x)=>n+Number(x.debit)-Number(x.credit),0)).toBe(100);
 },60000);
 it("prepares purchase duplicates and corrections without writes, and retains original cash and bill history",async()=>{
  const vendor=await client.vendor.create({data:{companyId,name:"Correction vendor"}});
  const bill=await createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",purchasePurpose:"GENERAL_OFFICE",branchId,partyId:vendor.id,postingDate:"2026-11-05",issueDate:"2026-11-05",vendorInvoiceNumber:`SUP-${randomUUID()}`,vendorInvoiceDate:"2026-11-05",lines:[{lineType:"CUSTOM",itemName:"Service",quantity:"1",rate:"100",taxRate:"0"}]});
  await postCommercialDocumentForActor(actor,{documentId:bill.id});
  const payment=await createAllocatedPaymentForActor(actor,{type:"VENDOR_PAYMENT",branchId,partyId:vendor.id,paymentMode:"CASH",transactionDate:"2026-11-05",amount:"20",idempotencyKey:randomUUID(),allocations:[{documentId:bill.id,amount:"20"}]});
  expect((await commercialDocumentControlsForActor(actor,bill.id)).canCorrectPurchase).toBe(true);
  expect((await commercialDocumentControlsForActor({...actor,accountRole:"DATA_ENTRY"},bill.id)).canCorrectPurchase).toBe(false);
  const source=await getCommercialDocumentForActor(actor,bill.id),before=await client.journalEntry.count({where:{companyId}}),documents=await client.commercialDocument.count({where:{companyId}});
  const duplicate=purchaseDuplicateDraft(source,"2026-11-06"),prepared=purchaseReturnDraft(source,"2026-11-06");
  expect(duplicate).not.toHaveProperty("vendorInvoiceNumber");expect(duplicate).not.toHaveProperty("sourceDocumentId");expect(duplicate.lines.every(line=>!line.sourceCommercialLineId&&!line.purchaseAllocations.length)).toBe(true);
  expect(prepared.sourceDocumentId).toBe(bill.id);expect(prepared.lines[0].sourceCommercialLineId).toBe(source.lines[0].id);
  expect(await client.commercialDocument.count({where:{companyId}})).toBe(documents);expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
  const note=await createCommercialDocumentForActor(actor,{type:"DEBIT_NOTE",purchasePurpose:prepared.purchasePurpose,branchId,partyId:vendor.id,sourceDocumentId:prepared.sourceDocumentId,issueDate:prepared.issueDate,lines:[{lineType:"CUSTOM",itemName:prepared.lines[0].itemName,quantity:"0.25",rate:prepared.lines[0].rate,taxRate:"0",sourceCommercialLineId:prepared.lines[0].sourceCommercialLineId,stockReturnQuantity:"0"}]});
  await postCommercialDocumentForActor(actor,{documentId:note.id});
  expect((await documentOutstandingsBatch(companyId,[bill])).get(bill.id)?.toString()).toBe("55");
  expect((await client.commercialDocument.findUniqueOrThrow({where:{id:bill.id}})).status).toBe("POSTED");expect((await client.accountSettlement.findUniqueOrThrow({where:{id:payment.id}})).status).toBe("POSTED");expect(await client.accountSettlement.count({where:{companyId,vendorId:vendor.id}})).toBe(1);
 });
});
