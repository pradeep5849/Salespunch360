import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {createCommercialDocumentForActor,postCommercialDocumentForActor,documentOutstandingInTx} from "./commercial";
import {postedPartyBalances} from "./posted-party-balances";
import {currentPartyBalanceForActor} from "./party-balance";
import {runFinancialReportForActor} from "./reports/service";
import {accountMobileHomeData} from "./mobile-home";
import {replacePostedSaleForActor,reversePostedSaleForActor} from "./sale-amendments";
import {createStockMovementForActor} from "./inventory";
import {saleDetailForActor} from "./sale-detail";
import type {ProjectActor} from "./projects";
const companyId=randomUUID(),branchId=randomUUID(),userId=randomUUID(),customerId=randomUUID(),productId=randomUUID();
const actor={id:userId,name:"Return revision admin",email:`${userId}@example.test`,companyId,role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,salesAccessActive:false,salesRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;
const raw=(rate="100",quantity="1")=>({type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-20",idempotencyKey:randomUUID(),lines:[{lineType:"PRODUCT",sourceId:productId,quantity,rate,taxRate:"0"}]});
async function returned(quantity="1",returnedQuantity="1",sourceProductId:string=productId,physicalQuantity="0",warehouseId?:string){
 const original={...raw("100",quantity),lines:[{...raw("100",quantity).lines[0],sourceId:sourceProductId,warehouseId}]};
 const source=await createCommercialDocumentForActor(actor,original);await postCommercialDocumentForActor(actor,{documentId:source.id});
 const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}});
 const credit=await createCommercialDocumentForActor(actor,{...raw("100",returnedQuantity),type:"CREDIT_NOTE",sourceDocumentId:source.id,lines:[{...raw("100",returnedQuantity).lines[0],sourceId:sourceProductId,stockReturnQuantity:physicalQuantity,warehouseId:line.warehouseId??undefined,sourceCommercialLineId:line.id}]});await postCommercialDocumentForActor(actor,{documentId:credit.id});
 return{source,line,credit};
}
describe.skipIf(!url)("A086 immutable posted return correction",()=>{
 beforeAll(async()=>{
  await client.company.create({data:{id:companyId,name:"Return revision fixture",slug:`return-revision-${companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.branch.create({data:{id:branchId,companyId,name:"Main",code:"MAIN",isPrimary:true}});
  await client.user.create({data:{id:userId,companyId,name:actor.name,email:actor.email,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
  await client.customer.create({data:{id:customerId,companyId,branchId,name:"Return party",isAccountCustomer:true}});
  await client.accountSettings.create({data:{companyId,enabledModules:[],transactionDefaults:{transactionPreferences:{linkPayments:false}}}});
  await client.financialYear.create({data:{companyId,name:"2026-27",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}});
  await client.ledgerAccount.createMany({data:DEFAULT_LEDGER_ACCOUNTS.map(row=>({...row,companyId}))});
  await client.accountProduct.create({data:{id:productId,companyId,name:"Returned item",salePrice:"100",trackInventory:false}});
 });
 afterAll(async()=>{
  await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
   await tx.saleLifecycleSnapshot.deleteMany({where:{companyId}});
   await tx.saleRevisionCreditLine.deleteMany({where:{companyId}});await tx.saleRevisionCredit.deleteMany({where:{companyId}});await tx.saleReturnRevision.deleteMany({where:{companyId}});
   await tx.stockMovement.deleteMany({where:{companyId}});
   await tx.commercialAttachment.deleteMany({where:{companyId}});await tx.commercialAuditEvent.deleteMany({where:{companyId}});await tx.accountOperationalAudit.deleteMany({where:{companyId}});await tx.accountingAuditEvent.deleteMany({where:{companyId}});
   await tx.advanceApplication.deleteMany({where:{companyId}});await tx.settlementAllocation.deleteMany({where:{companyId}});await tx.accountSettlement.deleteMany({where:{companyId}});await tx.commercialDocumentLine.deleteMany({where:{companyId}});await tx.commercialDocument.deleteMany({where:{companyId}});await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}});await tx.numberingSeries.deleteMany({where:{companyId}});await tx.ledgerAccount.deleteMany({where:{companyId}});await tx.financialYear.deleteMany({where:{companyId}});await tx.inventorySerialNumber.deleteMany({where:{companyId}});await tx.inventoryBatch.deleteMany({where:{companyId}});await tx.accountProduct.deleteMany({where:{companyId}});await tx.warehouse.deleteMany({where:{companyId}});await tx.accountUnit.deleteMany({where:{companyId}});await tx.customer.deleteMany({where:{companyId}});await tx.accountSettings.deleteMany({where:{companyId}});await tx.user.deleteMany({where:{companyId}});await tx.branch.deleteMany({where:{companyId}});await tx.company.delete({where:{id:companyId}});
  });await client.$disconnect();
 });
 it("keeps a billed100 credit unchanged, applies80 and retains20 as noncash advance",async()=>{
  const {source,line,credit}=await returned();const before=await client.commercialDocument.findUniqueOrThrow({where:{id:credit.id},include:{lines:{orderBy:{position:"asc"}},journalEntry:{include:{lines:{orderBy:{lineNumber:"asc"}}}}}});
  const request={...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]};
  const replacement=await replacePostedSaleForActor(actor,source.id,request);
  expect(await client.commercialDocument.findUniqueOrThrow({where:{id:credit.id},include:{lines:{orderBy:{position:"asc"}},journalEntry:{include:{lines:{orderBy:{lineNumber:"asc"}}}}}})).toEqual(before);
  expect(await client.commercialDocument.count({where:{companyId,type:"CREDIT_NOTE",sourceDocumentId:source.id}})).toBe(1);
  const carry=await client.saleRevisionCredit.findFirstOrThrow({where:{companyId,creditNoteId:credit.id},include:{excessAdvance:{include:{journalEntry:{include:{lines:true}}}}}});
  expect([carry.originalAmount.toString(),carry.appliedAmount.toString(),carry.excessAmount.toString()]).toEqual(["100","80","20"]);
  expect(carry.excessAdvance).toMatchObject({paymentMode:"ACCOUNT_CREDIT",moneyAccountId:null});expect(carry.excessAdvance!.amount.toString()).toBe("20");expect(carry.excessAdvance!.journalEntry!.lines.reduce((sum,row)=>sum.add(row.debit).sub(row.credit),carry.originalAmount.mul(0)).toString()).toBe("0");
  const detail=await saleDetailForActor(actor,replacement.id);expect(detail.documentNumber).toBe(source.documentNumber);expect(detail.paymentSummary).toMatchObject({outstanding:"0.00",credits:"80.00",originalReturnCredits:"100.00",returnCreditsTransferred:"20.00",canChange:true,canDelete:false});
  expect((await replacePostedSaleForActor(actor,source.id,request)).id).toBe(replacement.id);
  const home=await accountMobileHomeData(actor,{mode:"BRANCH",branchId,branchName:"Main"},{types:["SALES_INVOICE"]});
  expect(home.transactions.some(row=>row.id===source.id)).toBe(false);
  expect(home.transactions.find(row=>row.id===replacement.id)).toMatchObject({documentNumber:source.documentNumber,balanceDue:"0",showBalance:true});
  expect(home.parties.find(row=>row.id===customerId)?.balance).toBe("-20");
  const batch=await postedPartyBalances({companyId,partyIds:[customerId],customer:true,branches:[branchId]});expect(batch.get(customerId)!.toFixed(2)).toBe(await currentPartyBalanceForActor(actor,customerId));


 });
 it("retains partial original100 credit against repriced160 invoice",async()=>{
  const {source,line}=await returned("2");const replacement=await replacePostedSaleForActor(actor,source.id,{...raw("80","2"),lines:[{...raw("80","2").lines[0],originalLineId:line.id}]});
  const financial=await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacement.id));expect(financial.outstanding.toString()).toBe("60");expect(financial.returnCreditsApplied.toString()).toBe("100");
 });
 it("rejects reducing retained quantity below already billed returns atomically",async()=>{
  const {source,line}=await returned();const before=await client.journalEntry.count({where:{companyId}});
  await expect(replacePostedSaleForActor(actor,source.id,{...raw("80","0.5"),lines:[{...raw("80","0.5").lines[0],originalLineId:line.id}]})).rejects.toThrow("SALE_MUST_COVER_POSTED_RETURNS");
  expect(await client.journalEntry.count({where:{companyId}})).toBe(before);expect(await client.saleReturnRevision.count({where:{companyId,sourceInvoiceId:source.id}})).toBe(0);
 });
 it("reuses original credits through repeated reductions and increases without double counting",async()=>{
  const {source,line,credit}=await returned();
  let current=await replacePostedSaleForActor(actor,source.id,{...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]});
  for(const [rate,due,advance]of [["120","20","0"],["60","0","40"],["120","20","0"]]){
   const original=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:current.id}});
   current=await replacePostedSaleForActor(actor,current.id,{...raw(rate),lines:[{...raw(rate).lines[0],originalLineId:original.id}]});
   const financial=await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,current.id));expect(financial.outstanding.toString()).toBe(due);
   const credits=await client.accountSettlement.aggregate({where:{companyId,partyId:customerId,saleRevisionCreditSource:{is:{creditNoteId:credit.id}}},_sum:{remainingAmount:true}});
   // Released applications also retain customer credit, so use the full correction family.
   const family=await client.accountSettlement.findMany({where:{companyId,partyId:customerId,paymentMode:"ACCOUNT_CREDIT",remainingAmount:{gt:0}},select:{remainingAmount:true,saleRevisionCreditSource:{select:{creditNoteId:true}},advanceCreditSourceApplication:{select:{advance:{select:{saleRevisionCreditSource:{select:{creditNoteId:true}}}}}}}});
   const own=family.filter(row=>row.saleRevisionCreditSource?.creditNoteId===credit.id||row.advanceCreditSourceApplication?.advance.saleRevisionCreditSource?.creditNoteId===credit.id);
   expect(own.reduce((sum,row)=>sum+Number(row.remainingAmount),0)).toBe(Number(advance));expect(credits._sum.remainingAmount?.gte(0)??true).toBe(true);
  }
  expect((await client.commercialDocument.findUniqueOrThrow({where:{id:credit.id}})).grandTotal.toString()).toBe("100");
 });
 it("protects original credit, carry and excess-advance journal from mutation",async()=>{
  const {source,line,credit}=await returned();await replacePostedSaleForActor(actor,source.id,{...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]});
  const carry=await client.saleRevisionCredit.findFirstOrThrow({where:{companyId,creditNoteId:credit.id},include:{excessAdvance:true}});
  await expect(client.saleRevisionCredit.update({where:{id:carry.id},data:{appliedAmount:"79",excessAmount:"21"}})).rejects.toThrow("SALE_RETURN_REVISION_HISTORY_IMMUTABLE");
  await expect(client.commercialDocument.update({where:{id:credit.id},data:{grandTotal:"80"}})).rejects.toThrow();
  await expect(client.journalEntry.update({where:{id:carry.excessAdvance!.journalEntryId!},data:{status:"REVERSED"}})).rejects.toThrow();
 });
 it("creates only one replacement under concurrent retry",async()=>{
  const {source,line}=await returned();const request={...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]};
  const [first,replay]=await Promise.all([replacePostedSaleForActor(actor,source.id,request),replacePostedSaleForActor(actor,source.id,request)]);
  expect(first.id).toBe(replay.id);expect(await client.saleReturnRevision.count({where:{companyId,sourceInvoiceId:source.id}})).toBe(1);
  expect(await client.saleRevisionCredit.count({where:{companyId,revision:{sourceInvoiceId:source.id}}})).toBe(1);
 });

 it("does not let repricing make already returned units available for return twice",async()=>{
  const {source,line}=await returned("2");const replacement=await replacePostedSaleForActor(actor,source.id,{...raw("200","2"),lines:[{...raw("200","2").lines[0],originalLineId:line.id}]});
  const saved=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:replacement.id}});
  const credit=await createCommercialDocumentForActor(actor,{...raw("100","2"),type:"CREDIT_NOTE",sourceDocumentId:replacement.id,lines:[{...raw("100","2").lines[0],sourceCommercialLineId:saved.id}]});
  const count=await client.journalEntry.count({where:{companyId}});
  await expect(postCommercialDocumentForActor(actor,{documentId:credit.id})).rejects.toThrow("SALE_MUST_COVER_POSTED_RETURNS");expect(await client.journalEntry.count({where:{companyId}})).toBe(count);
 });

 it.each(["0","1"])("preserves the actual physical return quantity %s and COGS during correction",async physicalQuantity=>{
  const warehouse=await client.warehouse.create({data:{companyId,branchId,name:"Revision stock",code:`RETURN-${physicalQuantity}`}}),product=await client.accountProduct.create({data:{companyId,name:"Tracked returned item",salePrice:"100",trackInventory:true}});
  await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,quantity:"2",unitCost:"25",movementDate:"2026-10-19",sourceType:"RETURN_REVISION_FIXTURE",sourceId:randomUUID()});
  const {source,line,credit}=await returned("2","1",product.id,physicalQuantity,warehouse.id);
  // The replacement must preserve whether the original return moved stock.
  const initial=await client.stockMovement.findMany({where:{companyId,productId:product.id}});
  expect(initial.filter(row=>row.movementType==="SALE")).toHaveLength(1);
  const replacement=await replacePostedSaleForActor(actor,source.id,{...raw("80","2"),lines:[{...raw("80","2").lines[0],sourceId:product.id,warehouseId:warehouse.id,originalLineId:line.id}]});
  const movements=await client.stockMovement.findMany({where:{companyId,productId:product.id}});
  const incoming=new Set(["OPENING","ADJUSTMENT_IN","SALES_RETURN"]);expect(movements.reduce((sum,row)=>sum+(incoming.has(row.movementType)?1:-1)*Number(row.quantity),0)).toBe(Number(physicalQuantity));
  const reversal=movements.find(row=>row.sourceType==="SALE_REVISION_REVERSAL")!;expect(reversal.quantity.toString()).toBe("2");expect(reversal.totalCost.toString()).toBe("50");
  expect(await client.stockMovement.count({where:{companyId,sourceId:credit.id,movementType:"SALES_RETURN"}})).toBe(Number(physicalQuantity));
  expect((await client.commercialDocument.findUniqueOrThrow({where:{id:replacement.id}})).grandTotal.toString()).toBe("160");
 });

 it("shows immutable cancellation in the Home cancelled filter without an unpaid balance",async()=>{
  const source=await createCommercialDocumentForActor(actor,raw());await postCommercialDocumentForActor(actor,{documentId:source.id});const credit=await reversePostedSaleForActor(actor,source.id);
  const count=await client.journalEntry.count({where:{companyId}});
  const home=await accountMobileHomeData(actor,{mode:"BRANCH",branchId,branchName:"Main"},{types:["SALE_CANCELLED"]});expect(home.transactions.find(row=>row.id===source.id)).toMatchObject({status:"CANCELLED",balanceDue:"0",showBalance:false});
  const all=await accountMobileHomeData(actor,{mode:"BRANCH",branchId,branchName:"Main"},{});expect(all.transactions.some(row=>row.id===credit.id)).toBe(false);expect(await client.journalEntry.count({where:{companyId}})).toBe(count);
 });

 it.each([false,true])("preserves returned serial stock when subsequently resold=%s",async resold=>{
  const suffix=randomUUID().slice(0,8),warehouse=await client.warehouse.create({data:{companyId,branchId,name:`Serial ${suffix}`,code:`S${suffix}`}}),product=await client.accountProduct.create({data:{companyId,name:`Serial return ${suffix}`,trackInventory:true,trackingMode:"SERIAL"}}),serial=await client.inventorySerialNumber.create({data:{companyId,productId:product.id,serialNumber:`SER-${suffix}`}});
  await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,serialNumberId:serial.id,quantity:"1",unitCost:"25",movementDate:"2026-10-19",sourceType:"RETURN_REVISION_FIXTURE",sourceId:randomUUID()});
  const saleLine={...raw().lines[0],sourceId:product.id,warehouseId:warehouse.id,serialNumberId:serial.id},input={...raw(),lines:[saleLine]};
  const source=await createCommercialDocumentForActor(actor,input);await postCommercialDocumentForActor(actor,{documentId:source.id});const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}});
  const credit=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID(),type:"CREDIT_NOTE",sourceDocumentId:source.id,lines:[{...saleLine,sourceCommercialLineId:line.id,stockReturnQuantity:"1"}]});await postCommercialDocumentForActor(actor,{documentId:credit.id});
  if(resold){const second=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID()});await postCommercialDocumentForActor(actor,{documentId:second.id})}
  const replacement=await replacePostedSaleForActor(actor,source.id,{...input,idempotencyKey:randomUUID(),lines:[{...saleLine,rate:"80",originalLineId:line.id}]});
  const incoming=new Set(["OPENING","SALES_RETURN","ADJUSTMENT_IN"]),movements=await client.stockMovement.findMany({where:{companyId,productId:product.id,serialNumberId:serial.id}});
  expect(movements.reduce((sum,row)=>sum+(incoming.has(row.movementType)?1:-1)*Number(row.quantity),0)).toBe(resold?0:1);
  expect(movements.filter(row=>row.sourceType==="SALE_REVISION_REVERSAL")).toHaveLength(1);
  expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacement.id))).outstanding.toString()).toBe("0");
 });

 it("preserves historical secondary-unit conversion after the master mapping changes",async()=>{
  const suffix=randomUUID().slice(0,8),primary=await client.accountUnit.create({data:{companyId,name:`Piece ${suffix}`,symbol:`P${suffix}`}}),secondary=await client.accountUnit.create({data:{companyId,name:`Box ${suffix}`,symbol:`B${suffix}`}}),product=await client.accountProduct.create({data:{companyId,name:`Secondary return ${suffix}`,unitId:primary.id,secondaryUnitId:secondary.id,secondaryUnitsPerBase:"0.1",trackInventory:false}});
  const input={...raw(),lines:[{...raw().lines[0],sourceId:product.id,unitSelection:"SECONDARY"}]};const source=await createCommercialDocumentForActor(actor,input);await postCommercialDocumentForActor(actor,{documentId:source.id});const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}});
  expect(line.baseQuantity!.toString()).toBe("10");
  const credit=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID(),type:"CREDIT_NOTE",sourceDocumentId:source.id,lines:[{...input.lines[0],sourceCommercialLineId:line.id}]});await postCommercialDocumentForActor(actor,{documentId:credit.id});
  await client.accountProduct.update({where:{id:product.id},data:{secondaryUnitsPerBase:"0.2"}});
  const replacement=await replacePostedSaleForActor(actor,source.id,{...input,idempotencyKey:randomUUID(),lines:[{...input.lines[0],originalLineId:line.id,rate:"80"}]});
  const saved=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:replacement.id}});expect(saved.baseQuantity!.toString()).toBe("10");expect(saved.unitConversionSnapshot).toEqual(line.unitConversionSnapshot);
  const binding=await client.saleRevisionCreditLine.findFirstOrThrow({where:{companyId,invoiceLineId:saved.id}});expect(binding.quantity.toString()).toBe("10");
  expect((await client.commercialDocument.findUniqueOrThrow({where:{id:credit.id}})).grandTotal.toString()).toBe("100");
 });
 it("denies role, company and unassigned branch correction without side effects",async()=>{
  const {source,line}=await returned(),request={...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]};
  const count=await client.journalEntry.count({where:{companyId}});
  for(const denied of [{...actor,accountRole:"DATA_ENTRY"},{...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},{...actor,companyId:randomUUID()}])await expect(replacePostedSaleForActor(denied as ProjectActor,source.id,request)).rejects.toThrow();
  expect(await client.journalEntry.count({where:{companyId}})).toBe(count);expect(await client.saleReturnRevision.count({where:{companyId,sourceInvoiceId:source.id}})).toBe(0);
  const allowed=await replacePostedSaleForActor({...actor,accountRole:"ACCOUNTANT"},source.id,request);expect(allowed.status).toBe("POSTED");
 });

 it("keeps earlier P&L history unchanged and recognizes only the correction-date difference",async()=>{
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const profit=async(day:string)=>{const report=await runFinancialReportForActor(actor,"profit-loss",{branchId,from:day,to:day});return Number(report.rows.find(row=>row[0]==="Profit")![1])};
  const previousBefore=await profit("2026-10-20"),todayBefore=await profit(date);
  const {source,line}=await returned();const creditDate=new Date("2026-10-20");expect(creditDate.toISOString().slice(0,10)).not.toBe(date);
  const replacement=await replacePostedSaleForActor(actor,source.id,{...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]});
  expect(await profit("2026-10-20")).toBe(previousBefore);expect(await profit(date)).toBeCloseTo(todayBefore-20,2);
  const revision=await client.saleReturnRevision.findUniqueOrThrow({where:{companyId_invoiceId:{companyId,invoiceId:replacement.id}}});expect(revision.postingDate.toISOString().slice(0,10)).toBe(date);
  const sourceRow=await client.commercialDocument.findUniqueOrThrow({where:{id:source.id}}),target=await client.commercialDocument.findUniqueOrThrow({where:{id:replacement.id},include:{journalEntry:true}});
  expect(sourceRow.issueDate.toISOString().slice(0,10)).toBe("2026-10-20");expect(target.issueDate.toISOString().slice(0,10)).toBe("2026-10-20");expect(target.journalEntry!.entryDate.toISOString().slice(0,10)).toBe(date);
  const balance=await runFinancialReportForActor(actor,"balance-sheet",{branchId,from:"2026-01-01",to:date});expect(Number(balance.rows.find(row=>row[0]==="Difference")![1])).toBe(0);
 });

 it("retains a physical batch return and exact net COGS during correction",async()=>{
  const suffix=randomUUID().slice(0,8),warehouse=await client.warehouse.create({data:{companyId,branchId,name:`Batch ${suffix}`,code:`B${suffix}`}}),product=await client.accountProduct.create({data:{companyId,name:`Batch return ${suffix}`,trackInventory:true,trackingMode:"BATCH"}}),batch=await client.inventoryBatch.create({data:{companyId,productId:product.id,batchNumber:`BATCH-${suffix}`}});
  await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,batchId:batch.id,quantity:"2",unitCost:"25",movementDate:"2026-10-19",sourceType:"RETURN_REVISION_FIXTURE",sourceId:randomUUID()});
  const saleLine={...raw("100","2").lines[0],sourceId:product.id,warehouseId:warehouse.id,batchId:batch.id},input={...raw(),lines:[saleLine]};
  const source=await createCommercialDocumentForActor(actor,input);await postCommercialDocumentForActor(actor,{documentId:source.id});const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}});
  const credit=await createCommercialDocumentForActor(actor,{...input,idempotencyKey:randomUUID(),type:"CREDIT_NOTE",sourceDocumentId:source.id,lines:[{...saleLine,quantity:"1",sourceCommercialLineId:line.id,stockReturnQuantity:"1"}]});await postCommercialDocumentForActor(actor,{documentId:credit.id});
  const replacement=await replacePostedSaleForActor(actor,source.id,{...input,idempotencyKey:randomUUID(),lines:[{...saleLine,rate:"80",originalLineId:line.id}]});
  const incoming=new Set(["OPENING","SALES_RETURN","ADJUSTMENT_IN"]),movements=await client.stockMovement.findMany({where:{companyId,productId:product.id,batchId:batch.id}});expect(movements.reduce((sum,row)=>sum+(incoming.has(row.movementType)?1:-1)*Number(row.quantity),0)).toBe(1);
  const revision=await client.saleReturnRevision.findUniqueOrThrow({where:{companyId_invoiceId:{companyId,invoiceId:replacement.id}}});
  const documents=await client.commercialDocument.findMany({where:{companyId,id:{in:[source.id,credit.id,replacement.id]}},select:{journalEntryId:true}}),journalIds=[...documents.map(doc=>doc.journalEntryId!),revision.reversalJournalId];
  const costs=await client.journalLine.findMany({where:{companyId,journalEntryId:{in:journalIds},ledgerAccount:{systemKey:"COGS"}}});expect(costs.reduce((sum,row)=>sum+Number(row.debit)-Number(row.credit),0)).toBe(25);
  expect((await client.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacement.id))).outstanding.toString()).toBe("60");
 });

 it("scopes batched party history by branch company and historical cutoff",async()=>{
  const {source,line}=await returned();await replacePostedSaleForActor(actor,source.id,{...raw("80"),lines:[{...raw("80").lines[0],originalLineId:line.id}]});
  const current=await postedPartyBalances({companyId,partyIds:[customerId],customer:true,branches:[branchId]});expect(current.get(customerId)!.toFixed(2)).toBe(await currentPartyBalanceForActor(actor,customerId));
  for(const scope of [{companyId,branches:[randomUUID()]},{companyId:randomUUID(),branches:undefined},{companyId,branches:[]}])expect((await postedPartyBalances({...scope,partyIds:[customerId],customer:true})).get(customerId)!.toString()).toBe("0");
  expect((await postedPartyBalances({companyId,partyIds:[customerId],customer:true,branches:[branchId],asOf:new Date("2026-10-19")})).get(customerId)!.toString()).toBe("0");
 });

});
