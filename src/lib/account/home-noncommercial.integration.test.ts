import {randomUUID} from "node:crypto";
import {PrismaClient,type AccountModule} from "@prisma/client";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import type {Permission} from "@/lib/auth/permissions";
import type {ProjectActor} from "./projects";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {createSettlementForActor} from "./commercial";
import {createQuotationForActor} from "@/lib/quotations/service";
import {homeNonCommercialRows} from "./home-noncommercial";
const modules=new Set<AccountModule>(["CUSTOMER_RECEIPTS","VENDOR_PAYMENTS","EXPENSES","QUOTATIONS_BOQ"]),permissions=new Set<Permission>(["ACCOUNT_LEDGER_VIEW","ACCOUNT_EXPENSE_VIEW","ACCOUNT_QUOTATION_VIEW"]);
const companies=[randomUUID(),randomUUID()],branches=[randomUUID(),randomUUID()],users=[randomUUID(),randomUUID()];
const actors=companies.map((companyId,index)=>({id:users[index],name:"Home test",email:`${users[index]}@example.test`,companyId,role:"ACCOUNT_USER",isActive:true,accountRole:"ACCOUNT_ADMIN",accountAccessActive:true,salesAccessActive:false,salesRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor));
describe.skipIf(!url)("Home source adapters against isolated PostgreSQL",()=>{
 beforeAll(async()=>{
  for(let index=0;index<2;index++){
   const companyId=companies[index],branchId=branches[index],actor=actors[index],name=index?"FOREIGN-SECRET":"Own buyer";
   await client.company.create({data:{id:companyId,name,slug:`home-source-${companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
   await client.user.create({data:{id:users[index],companyId,name,email:actor.email,passwordHash:"isolated-fixture",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
   await client.branch.create({data:{id:branchId,companyId,name:"Home branch",code:"HOME"}});
   await client.financialYear.create({data:{companyId,name:"Home fixture year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
   for(const row of DEFAULT_LEDGER_ACCOUNTS)await client.ledgerAccount.create({data:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem}});
   const customer=await client.customer.create({data:{companyId,branchId,name,isAccountCustomer:true}});
   await createSettlementForActor(actor,{idempotencyKey:randomUUID(),type:"CUSTOMER_ADVANCE",branchId,partyId:customer.id,paymentMode:"CASH",amount:"100",transactionDate:"2026-10-11"});
   await createQuotationForActor(actor,{documentType:"ESTIMATE",branchId,customerId:customer.id,issueDate:"2026-10-12",lines:[{lineType:"CUSTOM",itemName:"Home estimate",quantity:"1",rate:"200",taxRate:"0"}]});
   const ledger=await client.ledgerAccount.findFirstOrThrow({where:{companyId,accountClass:"EXPENSE"}});
   const category=await client.expenseCategory.create({data:{companyId,name:`${name} expense`,scope:"EXPENSE",defaultLedgerAccountId:ledger.id}});
   await client.expenseTransaction.create({data:{companyId,branchId,categoryId:category.id,type:"OFFICE_EXPENSE",status:"DRAFT",transactionNumber:`EXP-${index}`,transactionDate:new Date("2026-10-13"),taxableAmount:"90",totalAmount:"90",createdById:users[index]}});
  }
 });
 afterAll(async()=>{
  for(const companyId of [...companies].reverse())await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
   await tx.quotationAuditEvent.deleteMany({where:{companyId}});
   await tx.quotationLine.deleteMany({where:{revision:{document:{companyId}}}});
   await tx.quotationAdjustment.deleteMany({where:{revision:{document:{companyId}}}});
   await tx.quotationPaymentSchedule.deleteMany({where:{revision:{document:{companyId}}}});
   await tx.quotationRevision.deleteMany({where:{document:{companyId}}});
   await tx.quotationDocument.deleteMany({where:{companyId}});
   await tx.expenseTransaction.deleteMany({where:{companyId}});await tx.expenseCategory.deleteMany({where:{companyId}});
   await tx.accountOperationalAudit.deleteMany({where:{companyId}});await tx.commercialAuditEvent.deleteMany({where:{companyId}});
   await tx.accountSettlement.deleteMany({where:{companyId}});await tx.accountingAuditEvent.deleteMany({where:{companyId}});
   await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}});
   await tx.customer.deleteMany({where:{companyId}});await tx.numberingSeries.deleteMany({where:{companyId}});
   await tx.financialYear.deleteMany({where:{companyId}});await tx.moneyAccount.deleteMany({where:{companyId}});await tx.ledgerAccount.deleteMany({where:{companyId}});
   await tx.user.deleteMany({where:{companyId}});await tx.branch.deleteMany({where:{companyId}});await tx.accountSettings.deleteMany({where:{companyId}});await tx.company.deleteMany({where:{id:companyId}});
  });await client.$disconnect();
 });
 it("reads actual payment, expense and latest-estimate sources without cross-company data or writes",async()=>{
  const before=await client.journalEntry.count({where:{companyId:companies[0]}});
  const rows=await homeNonCommercialRows(actors[0],{mode:"BRANCH",branchId:branches[0],branchName:"Home"},{q:"",types:[]},modules,permissions);
  expect(rows.map(row=>row.sourceKind).sort()).toEqual(["EXPENSE","QUOTATION","SETTLEMENT"]);expect(JSON.stringify(rows)).not.toContain("FOREIGN-SECRET");
  expect(rows.find(row=>row.sourceKind==="SETTLEMENT")).toMatchObject({grandTotal:"100",balanceDue:"100",type:"CUSTOMER_ADVANCE"});
  expect(rows.find(row=>row.sourceKind==="QUOTATION")).toMatchObject({grandTotal:"200",showBalance:false});expect(rows.find(row=>row.sourceKind==="EXPENSE")).toMatchObject({grandTotal:"90",showBalance:false});
  expect(await client.journalEntry.count({where:{companyId:companies[0]}})).toBe(before);
 });
 it("returns no data for an unassigned branch or unauthorized source permissions",async()=>{
  const actor={...actors[0],branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[branches[0]]};
  expect(await homeNonCommercialRows(actor,{mode:"BRANCH",branchId:branches[1],branchName:"Foreign"},{q:"",types:[]},modules,permissions)).toEqual([]);
  expect(await homeNonCommercialRows(actor,{mode:"COMPANY",branchId:null,branchName:null},{q:"",types:[]},modules,new Set())).toEqual([]);
 });
 it("applies each non-commercial filter to its real source",async()=>{
  for(const [type,kind] of [["CUSTOMER_RECEIPT","SETTLEMENT"],["EXPENSE","EXPENSE"],["ESTIMATE","QUOTATION"]]){
   const rows=await homeNonCommercialRows(actors[0],{mode:"COMPANY",branchId:null,branchName:null},{q:"",types:[type]},modules,permissions);expect(rows).toHaveLength(1);expect(rows[0].sourceKind).toBe(kind);
  }
 });
});
