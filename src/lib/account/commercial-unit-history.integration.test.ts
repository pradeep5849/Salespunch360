import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {createCommercialDocumentForActor,postCommercialDocumentForActor} from "./commercial";
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import type {ProjectActor} from "./projects";
const companyId=randomUUID(),branchId=randomUUID(),userId=randomUUID(),customerId=randomUUID(),primary=randomUUID(),secondary=randomUUID(),productId=randomUUID(),vendorId=randomUUID();
const actor={id:userId,name:"Unit admin",email:`${userId}@example.test`,companyId,role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,salesAccessActive:false,salesRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;
const input={type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-20",lines:[{lineType:"PRODUCT",sourceId:productId,quantity:"2",rate:"20",taxRate:"0"}]};
describe.skipIf(!url)("A058/A062 immutable primary-unit commercial history",()=>{
 beforeAll(async()=>{
  await client.company.create({data:{id:companyId,name:"Unit history fixture",slug:`unit-history-${companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.branch.create({data:{id:branchId,companyId,name:"Branch",code:"MAIN",isPrimary:true}});
  await client.user.create({data:{id:userId,companyId,name:"Unit admin",email:`${userId}@example.test`,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
  await client.customer.create({data:{id:customerId,companyId,branchId,name:"Unit party",isAccountCustomer:true}});
  await client.vendor.create({data:{id:vendorId,companyId,name:"Unit vendor"}});
  await client.accountSettings.create({data:{companyId,enabledModules:[]}});
  await client.financialYear.create({data:{companyId,name:"2026-27",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}});
  await client.ledgerAccount.createMany({data:DEFAULT_LEDGER_ACCOUNTS.map(row=>({...row,companyId}))});
  await client.accountUnit.createMany({data:[{id:primary,companyId,name:"Piece",symbol:"pc"},{id:secondary,companyId,name:"Box",symbol:"box"}]});
  await client.accountProduct.create({data:{id:productId,companyId,name:"Primary priced item",unitId:primary,secondaryUnitId:secondary,secondaryUnitsPerBase:"0.1",salePrice:"20",trackInventory:false}});
 });
 afterAll(async()=>{
  await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
   await tx.purchaseLineAllocation.deleteMany({where:{companyId}});await tx.commercialAuditEvent.deleteMany({where:{companyId}});await tx.commercialDocumentLine.deleteMany({where:{companyId}});await tx.commercialDocument.deleteMany({where:{companyId}});
   await tx.accountingAuditEvent.deleteMany({where:{companyId}});await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}});
   await tx.numberingSeries.deleteMany({where:{companyId}});await tx.ledgerAccount.deleteMany({where:{companyId}});await tx.financialYear.deleteMany({where:{companyId}});
   await tx.accountProduct.deleteMany({where:{companyId}});await tx.accountUnit.deleteMany({where:{companyId}});await tx.customer.deleteMany({where:{companyId}});await tx.vendor.deleteMany({where:{companyId}});await tx.accountSettings.deleteMany({where:{companyId}});await tx.user.deleteMany({where:{companyId}});await tx.branch.deleteMany({where:{companyId}});await tx.company.delete({where:{id:companyId}});
  });await client.$disconnect();
 });
 it("retains primary quantity and balanced posting while recording the configured mapping",async()=>{
  const doc=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID()});
  const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}});
  expect(line.baseQuantity?.toString()).toBe("2");expect(line.quantity.toString()).toBe("2");expect(line.unitConversionSnapshot).toMatchObject({version:1,selection:"PRIMARY",primaryUnitId:primary,secondaryUnitId:secondary,secondaryUnitsPerBase:"0.1"});expect(line.lineTotal.toString()).toBe("40");
  await postCommercialDocumentForActor(actor,{documentId:doc.id});
  const posted=await client.commercialDocument.findUniqueOrThrow({where:{id:doc.id}}),journal=await client.journalEntry.findUniqueOrThrow({where:{id:posted.journalEntryId!},include:{lines:true}});
  expect(journal.lines.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(0);
  await expect(client.commercialDocumentLine.update({where:{id:line.id},data:{baseQuantity:"1"}})).rejects.toThrow("FINANCIAL_HISTORY_IMMUTABLE");
  await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.2"}});
  await client.accountUnit.update({where:{id:primary},data:{name:"Renamed primary",symbol:"new-pc"}});
  try{
   const credit=await createCommercialDocumentForActor(actor,{...input,type:"CREDIT_NOTE",sourceDocumentId:doc.id,idempotencyKey:randomUUID(),lines:[{...input.lines[0],quantity:"0.5",sourceCommercialLineId:line.id}]});
   const correction=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:credit.id}});expect(correction.baseQuantity?.toString()).toBe("0.5");expect(correction.unitConversionSnapshot).toMatchObject({secondaryUnitsPerBase:"0.1"});expect(correction.lineTotal.toString()).toBe("10");expect(correction.unitName).toBe("Piece");expect(correction.unitSymbol).toBe("pc");
  }finally{await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.1"}});await client.accountUnit.update({where:{id:primary},data:{name:"Piece",symbol:"pc"}})}
 });
 it("preserves legacy NULL meaning instead of inventing a mapping on a correction",async()=>{
  const doc=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID()}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}});
  await client.$executeRaw`UPDATE commercial_document_lines SET "baseQuantity"=NULL,"unitConversionSnapshot"=NULL WHERE id=${line.id}::uuid`;
  await postCommercialDocumentForActor(actor,{documentId:doc.id});
  const correction=await createCommercialDocumentForActor(actor,{...input,type:"CREDIT_NOTE",sourceDocumentId:doc.id,idempotencyKey:randomUUID(),lines:[{...input.lines[0],quantity:"1",sourceCommercialLineId:line.id}]});
  const retained=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:correction.id}});expect(retained.unitConversionSnapshot).toBeNull();expect(retained.baseQuantity?.toString()).toBe("1");
 });
 it("stores exact primary quantities on purchase allocation snapshots",async()=>{
  const doc=await createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",branchId,partyId:vendorId,issueDate:"2026-10-20",purchasePurpose:"GENERAL_OFFICE",vendorInvoiceNumber:"UNIT-001",vendorInvoiceDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Office work",quantity:"2.5",rate:"20",taxRate:"0"}]});
  const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id},include:{purchaseAllocations:true}});expect(line.baseQuantity?.toString()).toBe("2.5");expect(line.purchaseAllocations).toHaveLength(1);expect(line.purchaseAllocations[0].baseQuantity?.toString()).toBe("2.5");expect(line.purchaseAllocations[0].totalAmount.toString()).toBe("50");
  await expect(client.purchaseLineAllocation.update({where:{id:line.purchaseAllocations[0].id},data:{baseQuantity:"0"}})).rejects.toThrow("purchase_allocation_base_quantity_positive");
 });
 it("database rejects malformed or inconsistent snapshots, including direct writes",async()=>{
  const doc=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID()}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}});
  for(const snapshot of [{}, {...line.unitConversionSnapshot as object,selection:"OTHER"},{...line.unitConversionSnapshot as object,secondaryUnitsPerBase:"0"},{...line.unitConversionSnapshot as object,primaryUnitId:secondary},{...line.unitConversionSnapshot as object,version:"1"}])await expect(client.$executeRaw`UPDATE commercial_document_lines SET "unitConversionSnapshot"=${JSON.stringify(snapshot)}::jsonb WHERE id=${line.id}::uuid`).rejects.toThrow("commercial_line_unit_snapshot_valid");
  await expect(client.commercialDocumentLine.update({where:{id:line.id},data:{baseQuantity:"1"}})).rejects.toThrow("commercial_line_unit_snapshot_valid");
  const secondarySnapshot={...line.unitConversionSnapshot as object,selection:"SECONDARY"};
  const [valid]=await client.$queryRaw<Array<{valid:boolean}>>`SELECT valid_commercial_unit_snapshot(${JSON.stringify(secondarySnapshot)}::jsonb,1,10) AS valid`;expect(valid.valid).toBe(true);
 });
});
