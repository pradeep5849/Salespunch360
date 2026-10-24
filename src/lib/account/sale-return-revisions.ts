import {randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {postJournalInTx,reverseJournalInTx} from "@/lib/accounting/service";
import {allocateDocumentNumberInTx} from "./numbering";
import {ensureOpenFinancialYearForDate} from "./financial-year";
import {requireAccountModules} from "./modules";
import {commercialBaseQuantity,commercialReturnBaseQuantity} from "./commercial-stock-quantity";
import type {ProjectActor} from "./projects";
const D=Prisma.Decimal.clone({precision:48});
type Note=Prisma.CommercialDocumentGetPayload<{include:{lines:true}}>;
type Line=Prisma.CommercialDocumentLineGetPayload<Record<string,never>>;
export type RetainedSaleReturn={note:Note;available:Prisma.Decimal;lines:Array<{creditLine:Line;sourceInvoiceLineId:string;quantity:Prisma.Decimal;physicalQuantity:Prisma.Decimal}>};
/** Carries are append-only applications, not rewritten/duplicated credit notes. */
export async function retainedSaleReturnsInTx(tx:Prisma.TransactionClient,companyId:string,invoiceId:string):Promise<RetainedSaleReturn[]>{
 const [direct,previous]=await Promise.all([
  tx.commercialDocument.findMany({where:{companyId,sourceDocumentId:invoiceId,type:"CREDIT_NOTE",status:"POSTED",journalEntry:{is:{status:"POSTED"}}},include:{lines:true},orderBy:[{issueDate:"asc"},{id:"asc"}]}),
  tx.saleReturnRevision.findUnique({where:{companyId_invoiceId:{companyId,invoiceId}},include:{credits:{include:{creditNote:{include:{lines:true,journalEntry:{select:{status:true}}}},lines:true}}}}),
 ]);
 const results=new Map<string,RetainedSaleReturn>();
 for(const note of direct){
  const lines=note.lines.map(creditLine=>{if(!creditLine.sourceCommercialLineId)throw new Error("SALE_RETURN_LINE_HISTORY_REQUIRED");return{creditLine,sourceInvoiceLineId:creditLine.sourceCommercialLineId,quantity:commercialBaseQuantity(creditLine),physicalQuantity:commercialReturnBaseQuantity(creditLine)}});
  if(!lines.length)throw new Error("SALE_RETURN_LINE_HISTORY_REQUIRED");
  results.set(note.id,{note,lines,available:new D(note.payableAmount??note.grandTotal)});
 }
 for(const carry of previous?.credits??[]){
  const note=carry.creditNote;
  if(note.status!=="POSTED"||note.journalEntry?.status!=="POSTED"||results.has(note.id))throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");
  const lines=note.lines.map(creditLine=>{const binding=carry.lines.find(row=>row.creditLineId===creditLine.id);if(!binding)throw new Error("SALE_RETURN_LINE_HISTORY_REQUIRED");return{creditLine,sourceInvoiceLineId:binding.invoiceLineId,quantity:new D(binding.quantity),physicalQuantity:new D(binding.physicalQuantity)}});
  if(!lines.length)throw new Error("SALE_RETURN_LINE_HISTORY_REQUIRED");
  results.set(note.id,{note,lines,available:new D(note.payableAmount??note.grandTotal)});
 }
 if(results.size){
  const converted=await tx.saleRevisionCredit.findMany({where:{companyId,creditNoteId:{in:[...results.keys()]},excessAdvance:{isNot:null}},select:{creditNoteId:true,excessAdvance:{select:{amount:true,status:true,journalEntry:{select:{status:true}}}}}});
  for(const row of converted){const advance=row.excessAdvance;if(!advance||advance.status!=="POSTED"||advance.journalEntry?.status!=="POSTED")throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");const item=results.get(row.creditNoteId)!;item.available=item.available.sub(advance.amount);if(item.available.lt(0))throw new Error("SALE_RETURN_HISTORY_INCONSISTENT")}
 }
 return [...results.values()].sort((a,b)=>a.note.issueDate.getTime()-b.note.issueDate.getTime()||a.note.id.localeCompare(b.note.id));
}
export function retainedSaleReturnAmount(items:RetainedSaleReturn[]){return items.reduce((sum,item)=>sum.add(item.available),new D(0))}
/** Link each immutable credit line to its retained original line in the replacement.
 * Removing an original line and adding lookalike text cannot evade return limits. */
export function saleReturnBindings(items:RetainedSaleReturn[],replacementLines:Line[],sourceLineIds:Map<number,string>){
 const bySource=new Map<string,Line>();for(const [position,id]of sourceLineIds){const line=replacementLines[position];if(!line||bySource.has(id))throw new Error("INVALID_SALE_LINE_SOURCE");bySource.set(id,line)}
 const totals=new Map<string,Prisma.Decimal>();
 return items.map(item=>({item,lines:item.lines.map(row=>{
  const line=bySource.get(row.sourceInvoiceLineId),credit=row.creditLine;
  if(!line)throw new Error("SALE_MUST_COVER_POSTED_RETURNS");
  const identity=(x:Line)=>JSON.stringify([x.lineType,x.productId,x.serviceId,x.workPackageId,x.warehouseId,x.batchId,x.serialNumberId,x.unitName,x.unitSymbol,x.unitConversionSnapshot??null]);
  if(identity(line)!==identity(credit))throw new Error("RETURN_REVISION_ITEM_UNIT_MISMATCH");
  const used=(totals.get(line.id)??new D(0)).add(row.quantity);totals.set(line.id,used);
  if(used.gt(commercialBaseQuantity(line)))throw new Error("SALE_MUST_COVER_POSTED_RETURNS");
  return{creditLineId:credit.id,invoiceLineId:line.id,quantity:row.quantity,physicalQuantity:row.physicalQuantity};
 })}));
}
export async function returnRevisionPostingDateInTx(tx:Prisma.TransactionClient,companyId:string,invoiceId:string){
 const row=await tx.saleReturnRevision.findUnique({where:{companyId_invoiceId:{companyId,invoiceId}},select:{postingDate:true}});
 return row?.postingDate;
}
export async function retainedSerialReturnQuantityInTx(tx:Prisma.TransactionClient,companyId:string,invoiceId:string,lineId:string){
 const rows=await tx.saleRevisionCreditLine.findMany({where:{companyId,invoiceLineId:lineId,credit:{revision:{invoiceId}}},select:{physicalQuantity:true}});
 return rows.reduce((sum,row)=>sum.add(row.physicalQuantity),new D(0));
}
async function excessReturnAdvanceInTx(tx:Prisma.TransactionClient,actor:ProjectActor,carryId:string,invoice:Omit<Note,"lines">,amount:Prisma.Decimal,date:Date){
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SETTLEMENT_ENTRY"))throw new AuthorizationError();
 await requireAccountModules(actor,"CUSTOMER_ADVANCES");
 const year=await ensureOpenFinancialYearForDate(actor.companyId,date,tx),accounts=await tx.ledgerAccount.findMany({where:{companyId:actor.companyId,isActive:true,allowPosting:true,systemKey:{in:["ACCOUNTS_RECEIVABLE","CUSTOMER_ADVANCES"]}}});
 const account=(key:string)=>{const row=accounts.find(item=>item.systemKey===key);if(!row)throw new Error("INVALID_LEDGER_ACCOUNT");return row.id};
 const id=randomUUID(),journal=await postJournalInTx(tx,actor,{financialYearId:year.id,branchId:invoice.branchId,entryDate:date,sourceType:"CUSTOMER_ADVANCE",sourceId:id,postingPurpose:"PRIMARY",lines:[{ledgerAccountId:account("ACCOUNTS_RECEIVABLE"),debit:amount.toFixed(2),credit:"0",description:"Unapplied original billed return value"},{ledgerAccountId:account("CUSTOMER_ADVANCES"),debit:"0",credit:amount.toFixed(2),description:"Return credit retained as customer advance; no cash movement"}]}),settlementNumber=await allocateDocumentNumberInTx(tx,{companyId:actor.companyId,branchId:invoice.branchId,seriesKey:"CUSTOMER_ADVANCE",defaults:{prefix:"CA-",padding:6}});
 return tx.accountSettlement.create({data:{id,companyId:actor.companyId,branchId:invoice.branchId,type:"CUSTOMER_ADVANCE",status:"POSTED",paymentMode:"ACCOUNT_CREDIT",saleRevisionCreditSourceId:carryId,settlementNumber,partyId:invoice.partyId,customerId:invoice.customerId,projectId:invoice.projectId,amount,remainingAmount:amount,transactionDate:date,journalEntryId:journal.id,idempotencyKey:`return-revision-credit:${carryId}`,createdById:actor.id,reference:invoice.documentNumber.slice(0,160),notes:"Original posted credit note retained; unapplied return value is customer credit"}});
}
/** Called only inside the existing serializable Sale amendment transaction after
 * authorized payment releases and before posting the replacement. */
export async function carrySaleReturnsInTx(tx:Prisma.TransactionClient,actor:ProjectActor,source:Note,replacement:Omit<Note,"lines">,items:RetainedSaleReturn[],sourceLineIds:Map<number,string>,date:Date){
 if(!items.length||source.companyId!==actor.companyId||replacement.companyId!==actor.companyId||source.branchId!==replacement.branchId||source.partyId!==replacement.partyId||source.projectId!==replacement.projectId||!source.journalEntryId)throw new Error("RETURN_REVISION_PARTY_PROJECT_MISMATCH");
 const ordered=await tx.commercialDocumentLine.findMany({where:{companyId:actor.companyId,documentId:replacement.id},orderBy:{position:"asc"}});
 const bound=saleReturnBindings(items,ordered,sourceLineIds);
 for(const item of items){if(!item.note.journalEntryId)throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM journal_entries WHERE id=${item.note.journalEntryId}::uuid AND "companyId"=${actor.companyId}::uuid AND status='POSTED' FOR UPDATE`;if(locked.length!==1)throw new Error("SALE_RETURN_HISTORY_INCONSISTENT")}
 await tx.$executeRaw`SELECT set_config('app.sale_return_revision_source_id',${source.id},true)`;
 const reversal=await reverseJournalInTx(tx,actor,{journalEntryId:source.journalEntryId,entryDate:date,reason:"Posted Sale revision; original billed credit notes retained"});
 const movements=await tx.stockMovement.findMany({where:{companyId:actor.companyId,sourceType:"SALES_INVOICE",sourceId:source.id,movementType:"SALE"},orderBy:{id:"asc"}});
 for(const movement of movements){
  if(!movement.sourceLineId||!source.lines.some(line=>line.id===movement.sourceLineId))throw new Error("SALE_STOCK_SOURCE_HISTORY_REQUIRED");
  const retained=[...sourceLineIds.values()].includes(movement.sourceLineId);
  if(retained){const product=await tx.accountProduct.findFirst({where:{id:movement.productId,companyId:actor.companyId},select:{trackInventory:true}});if(!product?.trackInventory)throw new Error("RETURN_REVISION_STOCK_CONFIGURATION_CHANGED")}
  await tx.stockMovement.create({data:{companyId:actor.companyId,branchId:movement.branchId,warehouseId:movement.warehouseId,productId:movement.productId,movementType:"ADJUSTMENT_IN",quantity:movement.quantity,unitCost:movement.unitCost,totalCost:movement.totalCost,sourceType:"SALE_REVISION_REVERSAL",sourceId:source.id,sourceLineId:movement.sourceLineId,batchId:movement.batchId,serialNumberId:movement.serialNumberId,reason:"Technical invoice revision reversal; not a physical return",movementDate:date,createdById:actor.id}});
 }
 const updated=await tx.commercialDocument.updateMany({where:{id:replacement.id,companyId:actor.companyId,status:"DRAFT"},data:{postingDate:date}});if(updated.count!==1)throw new Error("SALE_REPLACEMENT_ALREADY_POSTED");
 const revision=await tx.saleReturnRevision.create({data:{companyId:actor.companyId,sourceInvoiceId:source.id,invoiceId:replacement.id,reversalJournalId:reversal.id,postingDate:date,createdById:actor.id}});
 let remaining=new D(replacement.payableAmount??replacement.grandTotal);
 for(const {item,lines}of bound){
  const applied=Prisma.Decimal.min(remaining,item.available),excess=item.available.sub(applied);remaining=remaining.sub(applied);
  const carry=await tx.saleRevisionCredit.create({data:{companyId:actor.companyId,revisionId:revision.id,creditNoteId:item.note.id,originalAmount:item.note.payableAmount??item.note.grandTotal,availableAmount:item.available,appliedAmount:applied,excessAmount:excess,lines:{create:lines}}});
  if(excess.gt(0))await excessReturnAdvanceInTx(tx,actor,carry.id,replacement,excess,date);
 }
 return revision;
}

/** Include unused credits from every earlier revision, rather than only the
 * immediately preceding allocation. Otherwise repeated reductions strand part
 * of the original payment and a later increase asks the customer to pay twice. */
export async function saleCorrectionFamilyInTx(tx:Prisma.TransactionClient,companyId:string,source:{id:string;companyId:string;branchId:string;type:string;documentNumber:string}){
 const {saleInvoiceIdentity}=await import("./sale-invoice-identity");
 const ids:string[]=[],seen=new Set<string>();let current=source,expectedRevision:number|undefined;
 for(;;){
  if(current.companyId!==companyId||current.branchId!==source.branchId||current.type!=="SALES_INVOICE"||seen.has(current.id))throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");
  seen.add(current.id);ids.push(current.id);
  const identity=await saleInvoiceIdentity(tx,current);
  if(expectedRevision!==undefined&&identity.revision!==expectedRevision)throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");
  if(!identity.previousInvoiceId)break;
  expectedRevision=identity.revision-1;
  const previous=await tx.commercialDocument.findFirst({where:{id:identity.previousInvoiceId,companyId,branchId:source.branchId,type:"SALES_INVOICE"},select:{id:true,companyId:true,branchId:true,type:true,documentNumber:true}});
  if(!previous)throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");current=previous;
 }
 return ids;
}

/** Billed return quantities follow immutable source lines across revisions. A
 * lower rate must not make the same returned units available for return again. */
export async function assertSaleReturnQuantitiesInTx(tx:Prisma.TransactionClient,companyId:string,sourceInvoiceId:string,creditId:string,sourceLines:Line[],creditLines:Line[]){
 const [posted,carried]=await Promise.all([
  tx.commercialDocumentLine.findMany({where:{companyId,sourceCommercialLineId:{in:sourceLines.map(line=>line.id)},document:{type:"CREDIT_NOTE",status:"POSTED",id:{not:creditId},sourceDocumentId:sourceInvoiceId,journalEntry:{is:{status:"POSTED"}}}},select:{sourceCommercialLineId:true,quantity:true,baseQuantity:true}}),
  tx.saleRevisionCreditLine.findMany({where:{companyId,credit:{revision:{invoiceId:sourceInvoiceId}}},select:{invoiceLineId:true,quantity:true}}),
 ]);
 const used=new Map<string,Prisma.Decimal>();
 const add=(id:string,quantity:Prisma.Decimal)=>used.set(id,(used.get(id)??new D(0)).add(quantity));
 for(const row of posted){if(!row.sourceCommercialLineId)throw new Error("SALE_RETURN_LINE_HISTORY_REQUIRED");add(row.sourceCommercialLineId,commercialBaseQuantity(row))}
 for(const row of carried)add(row.invoiceLineId,new D(row.quantity));
 for(const row of creditLines){if(!row.sourceCommercialLineId)throw new Error("SALE_RETURN_LINE_HISTORY_REQUIRED");add(row.sourceCommercialLineId,commercialBaseQuantity(row))}
 for(const [id,quantity]of used){const source=sourceLines.find(line=>line.id===id);if(!source||quantity.gt(commercialBaseQuantity(source)))throw new Error("SALE_MUST_COVER_POSTED_RETURNS")}
}
