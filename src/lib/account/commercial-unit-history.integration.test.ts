import {receiptAdvanceCreditInTx,advanceApplicationCreditInTx} from "./receipt-advance-credit";
import {reverseJournalInTx} from "@/lib/accounting/service";
import {currentPartyBalanceForActor} from "./party-balance";
import {randomUUID} from "node:crypto";
import {Prisma,PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {createCommercialDocumentForActor,postCommercialDocumentForActor,getCommercialDocumentForActor,createSettlementForActor,documentOutstandingInTx,documentOutstandingsBatch,applyAdvanceForActor} from "./commercial";
import {submitSaleForActor} from "./sale-submit";
import {saleDuplicateDraft} from "./sale-duplicate";
import {saleDetailForActor} from "./sale-detail";
import {replacePostedSaleForActor,reversePostedSaleForActor} from "./sale-amendments";
import {salePriceProposalsForActor,confirmSalePriceForActor} from "./sale-price-updates";
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
   await tx.stockMovement.deleteMany({where:{companyId}});await tx.purchaseLineAllocation.deleteMany({where:{companyId}});await tx.commercialAuditEvent.deleteMany({where:{companyId}});await tx.advanceApplication.deleteMany({where:{companyId}});await tx.settlementAllocation.deleteMany({where:{companyId}});await tx.accountSettlement.deleteMany({where:{companyId}});await tx.commercialDocumentLine.deleteMany({where:{companyId}});await tx.commercialDocument.deleteMany({where:{companyId}});
   await tx.accountOperationalAudit.deleteMany({where:{companyId}});await tx.accountingAuditEvent.deleteMany({where:{companyId}});await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}});
   await tx.numberingSeries.deleteMany({where:{companyId}});await tx.ledgerAccount.deleteMany({where:{companyId}});await tx.financialYear.deleteMany({where:{companyId}});
   await tx.accountProduct.deleteMany({where:{companyId}});await tx.warehouse.deleteMany({where:{companyId}});await tx.accountUnit.deleteMany({where:{companyId}});await tx.customer.deleteMany({where:{companyId}});await tx.vendor.deleteMany({where:{companyId}});await tx.accountSettings.deleteMany({where:{companyId}});await tx.user.deleteMany({where:{companyId}});await tx.branch.deleteMany({where:{companyId}});await tx.company.delete({where:{id:companyId}});
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
 it("posts retained Box quantities as primary stock and reverses physical returns at original cost",async()=>{
  const trackedId=randomUUID(),warehouseId=randomUUID();
  await client.warehouse.create({data:{id:warehouseId,companyId,branchId,name:"Converted stock",code:`W-${warehouseId.slice(0,8)}`,isDefault:true}});
  await client.accountProduct.create({data:{id:trackedId,companyId,name:"Tracked primary-price item",unitId:primary,secondaryUnitId:secondary,secondaryUnitsPerBase:"0.1",salePrice:"20",costPrice:"5",trackInventory:true}});
  const purchase=await createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",branchId,partyId:vendorId,issueDate:"2026-10-20",purchasePurpose:"INVENTORY_SALES",vendorInvoiceNumber:"STOCK-001",vendorInvoiceDate:"2026-10-20",lines:[{lineType:"MATERIAL",sourceId:trackedId,unitSelection:"SECONDARY",quantity:"2",taxRate:"0",warehouseId}]});
  await postCommercialDocumentForActor(actor,{documentId:purchase.id});
  const sale=await createCommercialDocumentForActor(actor,{...input,lines:[{lineType:"PRODUCT",sourceId:trackedId,unitSelection:"SECONDARY",quantity:"1",taxRate:"0",warehouseId}]});
  const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
  await postCommercialDocumentForActor(actor,{documentId:sale.id});
  const receipt=await client.stockMovement.findFirstOrThrow({where:{companyId,sourceId:purchase.id,movementType:"PURCHASE"}});expect(receipt.quantity.toString()).toBe("20");expect(receipt.unitCost.toString()).toBe("5");
  const outbound=await client.stockMovement.findFirstOrThrow({where:{companyId,sourceId:sale.id,movementType:"SALE"}});expect(outbound.quantity.toString()).toBe("10");expect(outbound.unitCost.toString()).toBe("5");expect(outbound.totalCost.toString()).toBe("50");
  expect((await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id}})).grandTotal.toString()).toBe("200");
  const credit=await createCommercialDocumentForActor(actor,{...input,type:"CREDIT_NOTE",sourceDocumentId:sale.id,lines:[{lineType:"PRODUCT",sourceId:trackedId,sourceCommercialLineId:line.id,quantity:"0.5",stockReturnQuantity:"0.5",taxRate:"0",warehouseId}]});
  const creditLine=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:credit.id}});expect(creditLine.rate.toString()).toBe("200");expect(creditLine.lineTotal.toString()).toBe("100");
  await postCommercialDocumentForActor(actor,{documentId:credit.id});
  const restored=await client.stockMovement.findFirstOrThrow({where:{companyId,sourceId:credit.id,movementType:"SALES_RETURN"}});expect(restored.quantity.toString()).toBe("5");expect(restored.totalCost.toString()).toBe("25");
  const saleCost=await client.journalLine.findFirstOrThrow({where:{companyId,journalEntry:{sourceId:sale.id},ledgerAccount:{systemKey:"COGS"}}}),returnCost=await client.journalLine.findFirstOrThrow({where:{companyId,journalEntry:{sourceId:credit.id},ledgerAccount:{systemKey:"COGS"}}});expect(saleCost.debit.toString()).toBe("50");expect(returnCost.credit.toString()).toBe("25");
  const inventory=await client.journalLine.aggregate({where:{companyId,ledgerAccount:{systemKey:"INVENTORY_ASSET"}},_sum:{debit:true,credit:true}});expect(inventory._sum.debit!.sub(inventory._sum.credit??0).toString()).toBe("75");
  for(const id of [purchase.id,sale.id,credit.id]){const doc=await client.commercialDocument.findUniqueOrThrow({where:{id},include:{journalEntry:{include:{lines:true}}}});expect(doc.journalEntry!.lines.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(0)}
 });
 it("confirms only a retained primary-unit future price and keeps posted history intact",async()=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}}),original=await client.accountProduct.findUniqueOrThrow({where:{id:productId}});
  await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,updateSalePrice:true}}});
  try{
   const sale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],quantity:"1",rate:"210"}]}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}}),snapshot={...line.unitConversionSnapshot as object,selection:"SECONDARY",unitName:"Box",unitSymbol:"box"};
   await client.$executeRaw`UPDATE commercial_document_lines SET "baseQuantity"=10,"unitConversionSnapshot"=${JSON.stringify(snapshot)}::jsonb,"unitName"='Box',"unitSymbol"='box' WHERE id=${line.id}::uuid`;
   await postCommercialDocumentForActor(actor,{documentId:sale.id});
   const before=await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id},include:{lines:true}});
   await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.2"}});
   const proposals=await salePriceProposalsForActor(actor,sale.id);expect(proposals).toHaveLength(1);expect(proposals[0]).toMatchObject({lineId:line.id,oldPrice:"20",newPrice:"21"});
   expect((await client.accountProduct.findUniqueOrThrow({where:{id:productId}})).salePrice?.toString()).toBe("20");
   const consent={documentId:sale.id,lineId:line.id,expectedUpdatedAt:proposals[0].expectedUpdatedAt,requestKey:randomUUID(),confirmed:true};
   await confirmSalePriceForActor(actor,consent);await confirmSalePriceForActor(actor,consent);
   expect((await client.accountProduct.findUniqueOrThrow({where:{id:productId}})).salePrice?.toString()).toBe("21");
   expect(await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id},include:{lines:true}})).toEqual(before);
   expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_MASTER_PRICE_CONFIRMED",entityId:productId}})).toBe(1);
  }finally{await client.accountProduct.update({where:{id:productId},data:{salePrice:original.salePrice,pricing:original.pricing??Prisma.DbNull,secondaryUnitsPerBase:original.secondaryUnitsPerBase}});await client.accountSettings.update({where:{companyId},data:{itemSettings:settings.itemSettings??Prisma.DbNull}})}
 });
 it("retains authorized selected-unit history during an atomic posted-sale amendment",async()=>{
  const sale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],quantity:"1",rate:"200"}]}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
  const snapshot={...line.unitConversionSnapshot as object,selection:"SECONDARY",unitName:"Box",unitSymbol:"box"};
  await client.$executeRaw`UPDATE commercial_document_lines SET "baseQuantity"=10,"unitConversionSnapshot"=${JSON.stringify(snapshot)}::jsonb,"unitName"='Box',"unitSymbol"='box' WHERE id=${line.id}::uuid`;
  await postCommercialDocumentForActor(actor,{documentId:sale.id});
  const original=await client.commercialDocumentLine.findUniqueOrThrow({where:{id:line.id}});
  await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.2"}});
  try{
   const request={branchId,partyId:customerId,issueDate:"2026-10-20",idempotencyKey:randomUUID(),lines:[{originalLineId:line.id,lineType:"PRODUCT",sourceId:productId,quantity:"2",rate:"200",taxRate:"0",unitName:"Forged",unitSymbol:"bad"}]};
   await expect(createCommercialDocumentForActor(actor,input,undefined,{documentId:sale.id,lineIds:new Map([[0,line.id]])})).rejects.toThrow("SALE_AMENDMENT_TRANSACTION_REQUIRED");
   const forged=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],originalLineId:line.id,unitConversionSnapshot:snapshot,baseQuantity:"20"}]});
   const untrusted=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:forged.id}});
   expect(untrusted.baseQuantity?.toString()).toBe("2");expect(untrusted.unitConversionSnapshot).toMatchObject({selection:"PRIMARY",secondaryUnitsPerBase:"0.2"});
   const replacement=await replacePostedSaleForActor(actor,sale.id,request);
   const retained=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:replacement.id}});
   expect(replacement.status).toBe("POSTED");expect(replacement.grandTotal.toString()).toBe("400");
   expect(retained.quantity.toString()).toBe("2");expect(retained.baseQuantity?.toString()).toBe("20");
   expect(retained.unitConversionSnapshot).toEqual(snapshot);expect(retained.unitName).toBe("Box");expect(retained.unitSymbol).toBe("box");
   expect(await client.commercialDocumentLine.findUniqueOrThrow({where:{id:line.id}})).toEqual(original);
   expect((await replacePostedSaleForActor(actor,sale.id,request)).id).toBe(replacement.id);
   const credits=await client.commercialDocument.findMany({where:{companyId,sourceDocumentId:sale.id,type:"CREDIT_NOTE"},include:{lines:true}});
   expect(credits).toHaveLength(1);expect(credits[0].lines[0].baseQuantity?.toString()).toBe("10");
   for(const id of [sale.id,replacement.id,credits[0].id]){
    const doc=await client.commercialDocument.findUniqueOrThrow({where:{id},include:{journalEntry:{include:{lines:true}}}});
    expect(doc.journalEntry!.lines.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(0);
   }
  }finally{await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.1"}})}
 });
 it("duplicates selected units through explicit Sale Save without copying financial history",async()=>{
  const sale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],quantity:"1",rate:"200"}]}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
  const snapshot={...line.unitConversionSnapshot as object,selection:"SECONDARY",unitName:"Box",unitSymbol:"box"};
  await client.$executeRaw`UPDATE commercial_document_lines SET "baseQuantity"=10,"unitConversionSnapshot"=${JSON.stringify(snapshot)}::jsonb,"unitName"='Box',"unitSymbol"='box' WHERE id=${line.id}::uuid`;
  await postCommercialDocumentForActor(actor,{documentId:sale.id});
  const original=await client.commercialDocumentLine.findUniqueOrThrow({where:{id:line.id}});
  const copied=saleDuplicateDraft(await getCommercialDocumentForActor(actor,sale.id),"2026-10-20");
  await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.2"}});
  try{
   const request={...input,idempotencyKey:randomUUID(),copiedFromSaleId:copied.copiedFromSaleId,lines:copied.lines.map(row=>({lineType:row.lineType,sourceId:row.sourceId,quantity:row.quantity,rate:row.rate,taxRate:row.taxRate,copiedFromSaleLineId:row.copiedFromSaleLineId}))};
   await expect(submitSaleForActor(actor,{...request,lines:[{...request.lines[0],copiedFromSaleLineId:randomUUID()}]})).rejects.toThrow("INVALID_SALE_LINE_SOURCE");
   await expect(submitSaleForActor(actor,{...request,copiedFromSaleId:randomUUID()})).rejects.toThrow("INVALID_SALE_LINE_SOURCE");
   await expect(submitSaleForActor(actor,{...request,copiedFromSaleId:undefined})).rejects.toThrow();
   const saved=await submitSaleForActor(actor,request),retained=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:saved.id}});
   expect(saved.status).toBe("POSTED");expect(saved.id).not.toBe(sale.id);
   expect(retained.baseQuantity?.toString()).toBe("10");expect(retained.unitConversionSnapshot).toEqual(snapshot);expect(retained.sourceCommercialLineId).toBeNull();expect(retained.lineTotal.toString()).toBe("200");
   expect((await submitSaleForActor(actor,request)).id).toBe(saved.id);
   await expect(submitSaleForActor(actor,{...request,copiedFromSaleId:saved.id})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
   expect(await client.commercialDocumentLine.findUniqueOrThrow({where:{id:line.id}})).toEqual(original);
   expect(await client.commercialDocument.count({where:{companyId,sourceDocumentId:sale.id}})).toBe(0);
   expect(await client.settlementAllocation.count({where:{companyId,documentId:saved.id}})).toBe(0);
   const posted=await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id},include:{journalEntry:{include:{lines:true}}}});
   expect(posted.journalEntry!.lines.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(0);
  }finally{await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.1"}})}
 });
 it.each([{type:"FIXED",initial:"1",value:"3",amount:"3",total:"57"},{type:"PERCENTAGE",initial:"10",value:"10",amount:"6",total:"54"}])("retains the applied $type discount when master defaults later change",async scenario=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}}),original=await client.accountProduct.findUniqueOrThrow({where:{id:productId}});
  await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,itemWiseDiscount:true}}});
  await client.accountProduct.update({where:{id:productId},data:{pricing:{enteredSalePrice:"20",saleTaxMode:"EXCLUSIVE",discountType:scenario.type,discountValue:scenario.initial,normalizedDiscountValue:scenario.initial}}});
  try{
   const sale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],quantity:"3"}]}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
   expect(line.discountType).toBe(scenario.type);expect(line.discountValue?.toString()).toBe(scenario.value);expect(line.discountAmount.toString()).toBe(scenario.amount);expect(line.lineTotal.toString()).toBe(scenario.total);
   await postCommercialDocumentForActor(actor,{documentId:sale.id});
   await client.accountProduct.update({where:{id:productId},data:{pricing:{enteredSalePrice:"20",saleTaxMode:"EXCLUSIVE",discountType:scenario.type,discountValue:"9",normalizedDiscountValue:"9"}}});
   const copied=saleDuplicateDraft(await getCommercialDocumentForActor(actor,sale.id),"2026-10-20");
   const saved=await submitSaleForActor(actor,{...input,idempotencyKey:randomUUID(),lines:copied.lines.map(row=>({lineType:row.lineType,sourceId:row.sourceId,quantity:row.quantity,rate:row.rate,taxRate:row.taxRate,discountType:row.discountType,discountValue:row.discountValue}))});
   const retained=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:saved.id}});
   expect(retained.discountType).toBe(scenario.type);expect(retained.discountValue?.toString()).toBe(scenario.value);expect(retained.discountAmount.toString()).toBe(scenario.amount);expect(retained.lineTotal.toString()).toBe(scenario.total);
   const posted=await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id},include:{journalEntry:{include:{lines:true}}}});
   expect(posted.status).toBe("POSTED");expect(posted.journalEntry!.lines.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(0);
  }finally{await client.accountProduct.update({where:{id:productId},data:{pricing:original.pricing??Prisma.DbNull}});await client.accountSettings.update({where:{companyId},data:{itemSettings:settings.itemSettings??Prisma.DbNull}})}
 });
 it("recovers a legacy fixed discount for duplicate and atomic amendment without rewriting history",async()=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}}),originalMaster=await client.accountProduct.findUniqueOrThrow({where:{id:productId}});
  await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,itemWiseDiscount:true}}});
  await client.accountProduct.update({where:{id:productId},data:{pricing:{enteredSalePrice:"20",saleTaxMode:"EXCLUSIVE",discountType:"FIXED",discountValue:"1",normalizedDiscountValue:"1"}}});
  try{
   const sale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],quantity:"3"}]}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
   // Emulate old pre-snapshot persistence before posting, never mutate posted financial history.
   await client.commercialDocumentLine.update({where:{id:line.id},data:{discountValue:null}});
   await postCommercialDocumentForActor(actor,{documentId:sale.id});
   const original=await client.commercialDocumentLine.findUniqueOrThrow({where:{id:line.id}});
   await client.accountProduct.update({where:{id:productId},data:{pricing:{enteredSalePrice:"20",saleTaxMode:"EXCLUSIVE",discountType:"FIXED",discountValue:"9",normalizedDiscountValue:"9"}}});
   const copied=saleDuplicateDraft(await getCommercialDocumentForActor(actor,sale.id),"2026-10-20");
   expect(copied.lines[0].discountValue).toBe("3");
   const duplicate=await submitSaleForActor(actor,{...input,idempotencyKey:randomUUID(),lines:copied.lines.map(row=>({lineType:row.lineType,sourceId:row.sourceId,quantity:row.quantity,rate:row.rate,taxRate:row.taxRate,discountType:row.discountType,discountValue:row.discountValue}))});
   const replacement=await replacePostedSaleForActor(actor,sale.id,{branchId,partyId:customerId,issueDate:"2026-10-20",idempotencyKey:randomUUID(),lines:[{originalLineId:line.id,lineType:"PRODUCT",sourceId:productId,quantity:"3",rate:"20",taxRate:"0"}]});
   const credit=await client.commercialDocument.findFirstOrThrow({where:{companyId,sourceDocumentId:sale.id,type:"CREDIT_NOTE"}});
   for(const id of [duplicate.id,replacement.id,credit.id]){
    const doc=await client.commercialDocument.findUniqueOrThrow({where:{id},include:{lines:true,journalEntry:{include:{lines:true}}}});
    expect(doc.status).toBe("POSTED");expect(doc.grandTotal.toString()).toBe("57");expect(doc.lines[0].discountValue?.toString()).toBe("3");
    expect(doc.journalEntry!.lines.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(0);
   }
   expect(await client.commercialDocumentLine.findUniqueOrThrow({where:{id:line.id}})).toEqual(original);expect(original.discountValue).toBeNull();
  }finally{await client.accountProduct.update({where:{id:productId},data:{pricing:originalMaster.pricing??Prisma.DbNull}});await client.accountSettings.update({where:{companyId},data:{itemSettings:settings.itemSettings??Prisma.DbNull}})}
 });
 it.each([{cash:"100",discount:"0"},{cash:"90",discount:"10"}])("reclassifies receipt $cash plus discount $discount as reusable non-cash advance",async scenario=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}});
  await client.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","CUSTOMER_RECEIPTS","CUSTOMER_ADVANCES"],transactionDefaults:{transactionPreferences:{linkPayments:false,discountDuringPayment:true}}}});
  try{
   const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-18",lines:[{lineType:"CUSTOM",itemName:"Paid original",quantity:"1",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:sale.id});
   const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
   const receipt=await createSettlementForActor(actor,{idempotencyKey:randomUUID(),type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:scenario.cash,transactionDate:"2026-10-19",allocations:[{documentId:sale.id,amount:"100",discountAmount:scenario.discount}]});
   const original=await client.accountSettlement.findUniqueOrThrow({where:{id:receipt.id},include:{allocations:true,journalEntry:true}}),allocation=original.allocations[0];
   const balanceBefore=new Prisma.Decimal(await currentPartyBalanceForActor(actor,customerId));
   const cashBalance=async()=>{const cash=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"CASH"}}),rows=await client.journalLine.aggregate({where:{companyId,ledgerAccountId:cash.id},_sum:{debit:true,credit:true}});return new Prisma.Decimal(rows._sum.debit??0).sub(rows._sum.credit??0).toString()};
   const originalCash=await cashBalance(),date=new Date("2026-10-20");
   await expect(client.$transaction(tx=>receiptAdvanceCreditInTx(tx,{...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[randomUUID()]},{allocationId:allocation.id,entryDate:date}))).rejects.toThrow();
   await expect(client.$transaction(tx=>receiptAdvanceCreditInTx(tx,actor,{allocationId:allocation.id,entryDate:"2026-10-18"}))).rejects.toThrow("INVALID_RECEIPT_ADVANCE_CREDIT_DATE");
   const credit=await client.$transaction(async tx=>{
    const advance=await receiptAdvanceCreditInTx(tx,actor,{allocationId:allocation.id,entryDate:date});
    const correction=await createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",branchId,partyId:customerId,sourceDocumentId:sale.id,issueDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Paid original",quantity:"1",rate:"100",taxRate:"0",sourceCommercialLineId:line.id}]},tx);
    await postCommercialDocumentForActor(actor,{documentId:correction.id},tx);return advance;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   expect(credit.paymentMode).toBe("ACCOUNT_CREDIT");expect(credit.amount.toString()).toBe(scenario.cash);expect(credit.remainingAmount.toString()).toBe(scenario.cash);expect(credit.moneyAccountId).toBeNull();
   expect(await cashBalance()).toBe(originalCash);expect(await client.accountSettlement.findUniqueOrThrow({where:{id:receipt.id},include:{allocations:true,journalEntry:true}})).toEqual(original);
   expect(await currentPartyBalanceForActor(actor,customerId)).toBe(balanceBefore.sub(scenario.cash).toFixed(2));
   expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,sale.id))).outstanding.toString()).toBe("0");
   expect((await documentOutstandingsBatch(companyId,[sale],new Date("2026-10-19"))).get(sale.id)?.toString()).toBe("0");
   expect((await documentOutstandingsBatch(companyId,[sale],date)).get(sale.id)?.toString()).toBe("0");
   expect((await client.$transaction(tx=>receiptAdvanceCreditInTx(tx,actor,{allocationId:allocation.id,entryDate:date}))).id).toBe(credit.id);
   await expect(client.$transaction(tx=>receiptAdvanceCreditInTx(tx,actor,{allocationId:allocation.id,entryDate:"2026-10-21"}))).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
   await expect(createSettlementForActor(actor,{type:"CUSTOMER_ADVANCE",branchId,partyId:customerId,paymentMode:"ACCOUNT_CREDIT",amount:"1",transactionDate:"2026-10-20",allocations:[],idempotencyKey:randomUUID()})).rejects.toThrow("INVALID_PAYMENT_MODE");
   const replacement=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Corrected amount",quantity:"1",rate:"80",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:replacement.id});
   await applyAdvanceForActor(actor,{advanceId:credit.id,documentId:replacement.id,amount:"80",applicationDate:"2026-10-20",idempotencyKey:randomUUID()});
   expect((await client.accountSettlement.findUniqueOrThrow({where:{id:credit.id}})).remainingAmount.toString()).toBe(new Prisma.Decimal(scenario.cash).sub(80).toString());
   expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacement.id))).outstanding.toString()).toBe("0");expect(await cashBalance()).toBe(originalCash);
   await expect(client.$transaction(tx=>reverseJournalInTx(tx,actor,{journalEntryId:original.journalEntryId!,entryDate:"2026-10-20",reason:"Unsafe original receipt reversal"},{settlementId:receipt.id}))).rejects.toThrow("RECEIPT_HAS_ADVANCE_CREDIT");
   await expect(client.$transaction(tx=>reverseJournalInTx(tx,actor,{journalEntryId:credit.journalEntryId!,entryDate:"2026-10-20",reason:"Unsafe credit reversal"},{settlementId:credit.id}))).rejects.toThrow("RECEIPT_ADVANCE_CREDIT_NOT_REVERSIBLE");
   expect(await client.accountSettlement.count({where:{companyId,receiptCreditSourceAllocationId:allocation.id}})).toBe(1);
   const application=await client.advanceApplication.findFirstOrThrow({where:{documentId:replacement.id},include:{journalEntry:true}});
   const priorAdvance=await client.accountSettlement.findUniqueOrThrow({where:{id:credit.id}});
   const released=await client.$transaction(async tx=>{
    const next=await advanceApplicationCreditInTx(tx,actor,{applicationId:application.id,entryDate:date});
    const replacementLine=await tx.commercialDocumentLine.findFirstOrThrow({where:{documentId:replacement.id}});
    const reversal=await createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",branchId,partyId:customerId,sourceDocumentId:replacement.id,issueDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Corrected amount",quantity:"1",rate:"80",taxRate:"0",sourceCommercialLineId:replacementLine.id}]},tx);
    await postCommercialDocumentForActor(actor,{documentId:reversal.id},tx);return next;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   expect(released.amount.toString()).toBe("80");expect(released.remainingAmount.toString()).toBe("80");
   expect(await client.advanceApplication.findUniqueOrThrow({where:{id:application.id},include:{journalEntry:true}})).toEqual(application);
   expect(await client.accountSettlement.findUniqueOrThrow({where:{id:credit.id}})).toEqual(priorAdvance);
   expect(await cashBalance()).toBe(originalCash);
   expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacement.id))).outstanding.toString()).toBe("0");
   expect((await client.$transaction(tx=>advanceApplicationCreditInTx(tx,actor,{applicationId:application.id,entryDate:date}))).id).toBe(released.id);
   expect(await client.accountSettlement.count({where:{companyId,advanceCreditSourceApplicationId:application.id}})).toBe(1);

  }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:settings.enabledModules,transactionDefaults:settings.transactionDefaults??Prisma.DbNull}})}
 });
 it("paid edit removes the old discount and retains only excess actual cash as advance",async()=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}});
  await client.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","CUSTOMER_RECEIPTS","CUSTOMER_ADVANCES"],transactionDefaults:{transactionPreferences:{linkPayments:false,discountDuringPayment:true}}}});
  try{
   const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-18",lines:[{lineType:"CUSTOM",itemName:"Paid edit",quantity:"1",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:sale.id});
   const receipt=await createSettlementForActor(actor,{idempotencyKey:randomUUID(),type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:"90",transactionDate:"2026-10-19",allocations:[{documentId:sale.id,amount:"100",discountAmount:"10"}]});
   const original=await client.accountSettlement.findUniqueOrThrow({where:{id:receipt.id},include:{allocations:true,journalEntry:true}});
   const payload={idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Paid edit",quantity:"1",rate:"80",taxRate:"0"}]};
   expect((await saleDetailForActor(actor,sale.id)).paymentSummary.canChange).toBe(true);
   const replacement=await replacePostedSaleForActor(actor,sale.id,payload);
   expect(replacement.status).toBe("POSTED");
   expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacement.id))).outstanding.toString()).toBe("0");
   const credit=await client.accountSettlement.findFirstOrThrow({where:{receiptCreditSourceAllocationId:original.allocations[0].id}});
   expect(credit.amount.toString()).toBe("90");expect(credit.remainingAmount.toString()).toBe("10");
   expect(await client.accountSettlement.findUniqueOrThrow({where:{id:receipt.id},include:{allocations:true,journalEntry:true}})).toEqual(original);
   expect((await replacePostedSaleForActor(actor,sale.id,payload)).id).toBe(replacement.id);
  }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:settings.enabledModules,transactionDefaults:settings.transactionDefaults??Prisma.DbNull}})}
 });
 it.each(["RECEIPT","ADVANCE"] as const)("cancels a paid sale funded by %s while retaining actual funds",async kind=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}});
  await client.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","CUSTOMER_RECEIPTS","CUSTOMER_ADVANCES"],transactionDefaults:{transactionPreferences:{linkPayments:false}}}});
  try{
   const party=await client.customer.create({data:{companyId,branchId,name:`Cancellation ${kind}`,isAccountCustomer:true}});
   const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:party.id,issueDate:"2026-10-18",lines:[{lineType:"CUSTOM",itemName:"Cancel paid",quantity:"1",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:sale.id});
   const payment=await createSettlementForActor(actor,{idempotencyKey:randomUUID(),type:kind==="RECEIPT"?"CUSTOMER_RECEIPT":"CUSTOMER_ADVANCE",branchId,partyId:party.id,paymentMode:"CASH",amount:"90",transactionDate:"2026-10-19",...(kind==="RECEIPT"?{allocations:[{documentId:sale.id,amount:"90"}]}:{})});
   if(kind==="ADVANCE")await applyAdvanceForActor(actor,{advanceId:payment.id,documentId:sale.id,amount:"90",applicationDate:"2026-10-19",idempotencyKey:randomUUID()});
   const original=await client.accountSettlement.findUniqueOrThrow({where:{id:payment.id},include:{allocations:true,applications:true,journalEntry:true}});
   expect((await saleDetailForActor(actor,sale.id)).paymentSummary.canChange).toBe(true);
   expect(()=>reversePostedSaleForActor({...actor,accountRole:"DATA_ENTRY"},sale.id)).toThrow();
   await expect(reversePostedSaleForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[randomUUID()]},sale.id)).rejects.toThrow();
   await expect(reversePostedSaleForActor({...actor,companyId:randomUUID()},sale.id)).rejects.toThrow();
   const [correction,replayed]=await Promise.all([reversePostedSaleForActor(actor,sale.id),reversePostedSaleForActor(actor,sale.id)]);
   expect(replayed.id).toBe(correction.id);
   expect((await reversePostedSaleForActor(actor,sale.id)).id).toBe(correction.id);
   expect(await currentPartyBalanceForActor(actor,party.id)).toBe("-90.00");
   expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,sale.id))).outstanding.toString()).toBe("0");
   expect(await client.accountSettlement.findUniqueOrThrow({where:{id:payment.id},include:{allocations:true,applications:true,journalEntry:true}})).toEqual(original);
   expect((await saleDetailForActor(actor,sale.id)).paymentSummary.canChange).toBe(false);
   expect(await client.accountSettlement.count({where:{companyId,partyId:party.id,paymentMode:"ACCOUNT_CREDIT",remainingAmount:"90"}})).toBe(1);
  }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:settings.enabledModules,transactionDefaults:settings.transactionDefaults??Prisma.DbNull}})}
 });
 it("public secondary selection prices in primary units and retains the original return conversion",async()=>{
  const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}}),master=await client.accountProduct.findUniqueOrThrow({where:{id:productId}});
  await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,itemWiseDiscount:true},transactionDefaults:{transactionPreferences:{linkPayments:false}}}});
  await client.accountProduct.update({where:{id:productId},data:{pricing:{discountType:"FIXED",discountValue:"1",normalizedDiscountValue:"1",enteredSalePrice:"20",saleTaxMode:"EXCLUSIVE"},secondaryUnitsPerBase:"0.1"}});
  try{
   const source=await createCommercialDocumentForActor(actor,{...input,lines:[{lineType:"PRODUCT",sourceId:productId,unitSelection:"SECONDARY",quantity:"1",taxRate:"0"}]});
   await postCommercialDocumentForActor(actor,{documentId:source.id});
   const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}});
   expect(line.baseQuantity?.toString()).toBe("10");expect(line.quantity.toString()).toBe("1");expect(line.rate.toString()).toBe("200");expect(line.discountValue?.toString()).toBe("10");expect(line.lineTotal.toString()).toBe("190");expect(line.unitName).toBe("Box");
   expect(line.unitConversionSnapshot).toMatchObject({selection:"SECONDARY",secondaryUnitsPerBase:"0.1"});
   await client.accountProduct.update({where:{id:productId},data:{secondaryUnitsPerBase:"0.2"}});
   const correction=await createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",branchId,partyId:customerId,sourceDocumentId:source.id,issueDate:"2026-10-20",lines:[{lineType:"PRODUCT",sourceId:productId,sourceCommercialLineId:line.id,unitSelection:"SECONDARY",quantity:"1",rate:"200",discountType:"FIXED",discountValue:"10",taxRate:"0"}]});
   const returned=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:correction.id}});expect(returned.baseQuantity?.toString()).toBe("10");expect(returned.unitConversionSnapshot).toEqual(line.unitConversionSnapshot);
   await expect(createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",branchId,partyId:customerId,sourceDocumentId:source.id,issueDate:"2026-10-20",lines:[{lineType:"PRODUCT",sourceId:productId,sourceCommercialLineId:line.id,unitSelection:"PRIMARY",quantity:"1",rate:"200"}]})).rejects.toThrow("SOURCE_UNIT_MISMATCH");
   await postCommercialDocumentForActor(actor,{documentId:correction.id});
   await client.accountUnit.update({where:{id:secondary},data:{isActive:false}});
   await expect(createCommercialDocumentForActor(actor,{...input,lines:[{lineType:"PRODUCT",sourceId:productId,unitSelection:"SECONDARY",quantity:"1"}]})).rejects.toThrow("UNIT_CONVERSION_UNAVAILABLE");
  }finally{await client.accountUnit.update({where:{id:secondary},data:{isActive:true}});await client.accountProduct.update({where:{id:productId},data:{pricing:master.pricing??Prisma.DbNull,secondaryUnitsPerBase:master.secondaryUnitsPerBase}});await client.accountSettings.update({where:{companyId},data:{itemSettings:settings.itemSettings??Prisma.DbNull,transactionDefaults:settings.transactionDefaults??Prisma.DbNull}})}
 });
 it("database rejects malformed or inconsistent snapshots, including direct writes",async()=>{
  const doc=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID()}),line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}});
  for(const snapshot of [{}, {...line.unitConversionSnapshot as object,selection:"OTHER"},{...line.unitConversionSnapshot as object,secondaryUnitsPerBase:"0"},{...line.unitConversionSnapshot as object,primaryUnitId:secondary},{...line.unitConversionSnapshot as object,version:"1"}])await expect(client.$executeRaw`UPDATE commercial_document_lines SET "unitConversionSnapshot"=${JSON.stringify(snapshot)}::jsonb WHERE id=${line.id}::uuid`).rejects.toThrow("commercial_line_unit_snapshot_valid");
  await expect(client.commercialDocumentLine.update({where:{id:line.id},data:{baseQuantity:"1"}})).rejects.toThrow("commercial_line_unit_snapshot_valid");
  const secondarySnapshot={...line.unitConversionSnapshot as object,selection:"SECONDARY"};
  const [valid]=await client.$queryRaw<Array<{valid:boolean}>>`SELECT valid_commercial_unit_snapshot(${JSON.stringify(secondarySnapshot)}::jsonb,1,10) AS valid`;expect(valid.valid).toBe(true);
 });
});
