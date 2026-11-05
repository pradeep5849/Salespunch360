import {randomUUID} from "node:crypto";
import {PrismaClient,Prisma} from "@prisma/client";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import type {ProjectActor} from "./projects";
const url=process.env.RESTORE_TEST_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/allocated_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {createCommercialDocumentForActor,postCommercialDocumentForActor,documentOutstandingsBatch} from "./commercial";
import {createAllocatedPaymentForActor} from "./allocated-payment";
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
});
