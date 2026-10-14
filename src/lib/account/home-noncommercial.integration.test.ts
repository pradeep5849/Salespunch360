import sharp from "sharp";
import {randomUUID} from "node:crypto";
import {PrismaClient,type AccountModule} from "@prisma/client";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import type {Permission} from "@/lib/auth/permissions";
import type {ProjectActor} from "./projects";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
const objects=new Map<string,Buffer>();
vi.mock("@/lib/storage",()=>({privateStorage:()=>({put:async(key:string,data:Buffer)=>{objects.set(key,data)},get:async(key:string)=>{const data=objects.get(key);if(!data)throw new Error("NOT_FOUND");return data},delete:async(key:string)=>{objects.delete(key)}})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {loadPrintDocumentForActor} from "./print";
import {prepareTransferImage,addTransferImageForActor,transferImageForActor} from "./money-transfer-image";
import {createMoneyTransferForActor} from "./money";
import {createCommercialDocumentForActor,createSettlementForActor} from "./commercial";
import {createQuotationForActor} from "@/lib/quotations/service";
import {homeSettlementForActor} from "./home-settlement";
import {accountMobileHomeData} from "./mobile-home";
import {homeNonCommercialRows} from "./home-noncommercial";
const modules=new Set<AccountModule>(["CUSTOMER_RECEIPTS","CUSTOMER_ADVANCES","VENDOR_PAYMENTS","VENDOR_ADVANCES","EXPENSES","QUOTATIONS_BOQ"]),permissions=new Set<Permission>(["ACCOUNT_LEDGER_VIEW","ACCOUNT_EXPENSE_VIEW","ACCOUNT_QUOTATION_VIEW"]);
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
   await tx.moneyTransferImage.deleteMany({where:{companyId}});await tx.moneyTransfer.deleteMany({where:{companyId}});
   await tx.accountOperationalAudit.deleteMany({where:{companyId}});await tx.commercialAuditEvent.deleteMany({where:{companyId}});
   await tx.accountSettlement.deleteMany({where:{companyId}});await tx.commercialDocumentLine.deleteMany({where:{document:{companyId}}});await tx.commercialDocument.deleteMany({where:{companyId}});await tx.accountingAuditEvent.deleteMany({where:{companyId}});
   await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}});
   await tx.project.deleteMany({where:{companyId}});await tx.customer.deleteMany({where:{companyId}});await tx.numberingSeries.deleteMany({where:{companyId}});
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
 it("reads a payment destination without posting and denies foreign or unassigned records",async()=>{
  const own=await client.accountSettlement.findFirstOrThrow({where:{companyId:companies[0]}}),foreign=await client.accountSettlement.findFirstOrThrow({where:{companyId:companies[1]}});
  const before=await client.journalEntry.count({where:{companyId:companies[0]}});
  const view=await homeSettlementForActor(actors[0],own.id);expect(view).toMatchObject({entry:{partyName:"Own buyer",grandTotal:"100",balanceDue:"100"},discountAmount:"0",applications:[]});expect(JSON.stringify(view)).not.toMatch(/journalEntryId|ledgerAccountId|FOREIGN-SECRET/);
  expect(await homeSettlementForActor(actors[0],foreign.id)).toBeNull();expect(await homeSettlementForActor({...actors[0],branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},own.id)).toBeNull();expect(await homeSettlementForActor({...actors[0],accountRole:"PROJECT_MANAGER"},own.id)).toBeNull();expect(await homeSettlementForActor(actors[0],"not-a-uuid")).toBeNull();
  await expect(homeSettlementForActor({...actors[0],accountRole:null},own.id)).rejects.toThrow();expect(await client.journalEntry.count({where:{companyId:companies[0]}})).toBe(before);
 });
 it("applies each non-commercial filter to its real source",async()=>{
  for(const [type,kind] of [["CUSTOMER_RECEIPT","SETTLEMENT"],["EXPENSE","EXPENSE"],["ESTIMATE","QUOTATION"]]){
   const rows=await homeNonCommercialRows(actors[0],{mode:"COMPANY",branchId:null,branchName:null},{q:"",types:[type]},modules,permissions);expect(rows).toHaveLength(1);expect(rows[0].sourceKind).toBe(kind);
  }
 });
 it("merges real sources in Home date order with source destinations and no writes",async()=>{
  const companyId=companies[0],context={mode:"BRANCH" as const,branchId:branches[0],branchName:"Home"};
  const before=await client.journalEntry.count({where:{companyId}});
  const all=await accountMobileHomeData(actors[0],context,{includeNonCommercial:true});
  expect(all.transactions.map(row=>row.sourceKind)).toEqual(["EXPENSE","QUOTATION","SETTLEMENT"]);
  expect(all.transactions[0]).toMatchObject({printType:null,showBalance:false});
  expect(all.transactions[1].detailHref).toMatch(/^\/workspace\/account\/quotations\//);
  expect(all.transactions[2].detailHref).toMatch(/^\/workspace\/account\/settlements\//);
  const filtered=await accountMobileHomeData(actors[0],context,{includeNonCommercial:true,types:["CUSTOMER_RECEIPT"]});
  expect(filtered.transactions).toHaveLength(1);expect(filtered.transactions[0].sourceKind).toBe("SETTLEMENT");
  expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
 });
 it("stores one authorized private transfer image with safe concurrent retries and no financial repost",async()=>{
  const companyId=companies[0],actor=actors[0],accounts:string[]=[];
  for(let index=0;index<2;index++){const ledger=await client.ledgerAccount.create({data:{companyId,code:`IMAGE-${index}`,name:`Image transfer account ${index}`,accountClass:"ASSET",normalBalance:"DEBIT"}});accounts.push((await client.moneyAccount.create({data:{companyId,branchId:branches[0],type:"BANK",name:`Image bank ${index}`,ledgerAccountId:ledger.id}})).id);}
  const transfer=await createMoneyTransferForActor(actor,{branchId:branches[0],sourceAccountId:accounts[0],destinationAccountId:accounts[1],amount:"5",description:"Image transfer",transferDate:"2026-10-11",idempotencyKey:randomUUID()});
  const pixels=await sharp({create:{width:2,height:2,channels:3,background:"red"}}).png().toBuffer(),image=await prepareTransferImage(new File([new Uint8Array(pixels)],"../../proof.png",{type:"image/png"}));
  const count=await client.journalEntry.count({where:{companyId}}),[first,second]=await Promise.all([addTransferImageForActor(actor,transfer.id,image),addTransferImageForActor(actor,transfer.id,image)]);expect(first).toBe(second);expect(await client.moneyTransferImage.count({where:{companyId,transferId:transfer.id}})).toBe(1);
  const downloaded=await transferImageForActor(actor,transfer.id);expect(downloaded.name).toBe("proof.png");expect(downloaded.data.equals(image.data)).toBe(true);expect(objects.size).toBe(1);
  await expect(transferImageForActor(actors[1],transfer.id)).rejects.toThrow("TRANSFER_NOT_FOUND");await expect(transferImageForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},transfer.id)).rejects.toThrow("TRANSFER_NOT_FOUND");await expect(addTransferImageForActor({...actor,accountRole:"PROJECT_MANAGER"},transfer.id,image)).rejects.toThrow();
  await expect(addTransferImageForActor(actor,transfer.id,{...image,hash:"0".repeat(64)})).rejects.toThrow("TRANSFER_IMAGE_ALREADY_ATTACHED");expect(await client.journalEntry.count({where:{companyId}})).toBe(count);
 });
 it("allows managed-project payment and invoice views while denying another project",async()=>{
  const companyId=companies[0],branchId=branches[0],pmId=randomUUID();
  await client.user.create({data:{id:pmId,companyId,name:"Project manager",email:`${pmId}@example.test`,passwordHash:"isolated-fixture",role:"ACCOUNT_USER",accountRole:"PROJECT_MANAGER",accountAccessActive:true}});
  const customer=await client.customer.findFirstOrThrow({where:{companyId}}),pm={...actors[0],id:pmId,accountRole:"PROJECT_MANAGER" as const,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[branchId]};
  const own=await client.project.create({data:{companyId,branchId,customerId:customer.id,createdById:users[0],projectManagerId:pmId,projectNumber:"HOME-PM",name:"Managed project",status:"ACTIVE",startDate:new Date("2026-01-01"),projectValue:"1000"}});
  const other=await client.project.create({data:{companyId,branchId,customerId:customer.id,createdById:users[0],projectManagerId:users[0],projectNumber:"HOME-OTHER",name:"Other project",status:"ACTIVE",startDate:new Date("2026-01-01"),projectValue:"1000"}});
  const payment=await createSettlementForActor(actors[0],{idempotencyKey:randomUUID(),type:"CUSTOMER_ADVANCE",branchId,projectId:own.id,partyId:customer.id,paymentMode:"CASH",amount:"10",transactionDate:"2026-10-11"});
  const invoice=await createCommercialDocumentForActor(actors[0],{type:"SALES_INVOICE",branchId,partyId:customer.id,projectId:own.id,issueDate:"2026-10-11",lines:[{lineType:"CUSTOM",itemName:"Managed invoice",quantity:"1",rate:"50",taxRate:"0"}]});
  const foreignInvoice=await createCommercialDocumentForActor(actors[0],{type:"SALES_INVOICE",branchId,partyId:customer.id,projectId:other.id,issueDate:"2026-10-11",lines:[{lineType:"CUSTOM",itemName:"Other invoice",quantity:"1",rate:"70",taxRate:"0"}]});
  await client.accountSettings.upsert({where:{companyId},create:{companyId,enabledModules:["PROJECTS"],transactionDefaults:{invoicePrintSettings:{partyCurrentBalance:true}}},update:{transactionDefaults:{invoicePrintSettings:{partyCurrentBalance:true}}}});
  const journalCount=await client.journalEntry.count({where:{companyId}});
  expect((await homeSettlementForActor(pm,payment.id))?.entry.grandTotal).toBe("10");
  expect((await homeNonCommercialRows(pm,{mode:"BRANCH",branchId,branchName:"Home"},{q:"",types:["CUSTOMER_RECEIPT"]},modules,permissions)).map(row=>row.id)).toEqual([payment.id]);
  const receipt=await loadPrintDocumentForActor(pm,"CUSTOMER_ADVANCE",payment.id);expect(receipt.document.total).toBe("10");
  const view=await loadPrintDocumentForActor(pm,"SALES_INVOICE",invoice.id);expect(view.document.total).toBe("50");expect(view.document.partyCurrentBalance).toBeUndefined();
  await expect(loadPrintDocumentForActor(pm,"SALES_INVOICE",foreignInvoice.id)).rejects.toThrow("PRINT_DOCUMENT_NOT_FOUND");expect(await client.journalEntry.count({where:{companyId}})).toBe(journalCount);
 });

});
