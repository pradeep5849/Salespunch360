import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { requireAccountModules } from "./modules";
import { resolveItemSettings } from "./item-settings-policy";
import { pricingForLegacyEdit } from "./item-pricing";
import { retrySerializable } from "./transaction-retry";
import type { ProjectActor } from "./projects";
export type SalePriceProposal={lineId:string;sourceKey:string;name:string;oldPrice:string;newPrice:string;expectedUpdatedAt:string};
const input=z.object({documentId:z.string().uuid(),lineId:z.string().uuid(),expectedUpdatedAt:z.string().datetime(),requestKey:z.string().uuid(),confirmed:z.literal(true)}).strict();
async function access(actor:ProjectActor){
 if(!actor.companyId||actor.accountRole==="PROJECT_MANAGER"||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_STOCK")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SALES_ENTRY"))throw new AuthorizationError();
 await requireAccountModules(actor,"SALES","INVENTORY");
}
async function document(tx:Prisma.TransactionClient,actor:ProjectActor,id:string){
 const doc=await tx.commercialDocument.findFirst({where:{id,companyId:actor.companyId,type:"SALES_INVOICE",...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})},include:{lines:{orderBy:{position:"asc"}},journalEntry:{select:{status:true}}}});
 if(!doc)throw new AuthorizationError();return doc;
}
async function policy(tx:Prisma.TransactionClient,companyId:string){return resolveItemSettings((await tx.accountSettings.findUnique({where:{companyId},select:{itemSettings:true}}))?.itemSettings);}
export function retailRateFromInvoice(rate:Prisma.Decimal,taxMode:string,tax:Prisma.Decimal,cess:Prisma.Decimal){return (taxMode==="INCLUSIVE"?rate.mul(100).div(new Prisma.Decimal(100).add(tax).add(cess)):rate).toDecimalPlaces(2);}
async function proposal(tx:Prisma.TransactionClient,actor:ProjectActor,doc:Awaited<ReturnType<typeof document>>,lineId:string){
 const line=doc.lines.find(l=>l.id===lineId);if(!line)throw new AuthorizationError();
 const product=line.lineType==="PRODUCT"&&line.productId?await tx.accountProduct.findFirst({where:{id:line.productId,companyId:actor.companyId,isActive:true}}):null;
 const service=line.lineType==="SERVICE"&&line.serviceId?await tx.accountService.findFirst({where:{id:line.serviceId,companyId:actor.companyId,isActive:true}}):null;
 const master=product??service;if(!master)return null;
 const oldRate=product?.salePrice??service?.sellingRate??new Prisma.Decimal(0);
 const rate=retailRateFromInvoice(line.rate,doc.taxMode,line.taxRate,line.cessRate);
 return {master,product,service,rate,view:{lineId:line.id,sourceKey:`${line.lineType}:${master.id}`,name:line.itemName,oldPrice:oldRate.toString(),newPrice:rate.toString(),expectedUpdatedAt:master.updatedAt.toISOString()} satisfies SalePriceProposal};
}
export async function salePriceProposalsForActor(actor:ProjectActor,documentId:string):Promise<SalePriceProposal[]>{
 await access(actor);z.string().uuid().parse(documentId);
 return db.$transaction(async tx=>{
  const doc=await document(tx,actor,documentId),settings=await policy(tx,actor.companyId!);
  if(!settings.enabled||!settings.updateSalePrice||doc.status!=="POSTED"||doc.journalEntry?.status!=="POSTED")return [];
  const rows:SalePriceProposal[]=[];
  for(const line of doc.lines){const p=await proposal(tx,actor,doc,line.id);if(p&&p.view.oldPrice!==p.view.newPrice)rows.push(p.view);}
  return rows;
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
/** Explicit post-save consent changes only future master pricing, never the posted invoice/ledger. */
export async function confirmSalePriceForActor(actor:ProjectActor,raw:unknown){
 await access(actor);const d=input.parse(raw),hash=createHash("sha256").update(JSON.stringify(d)).digest("hex");
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
  const doc=await document(tx,actor,d.documentId),settings=await policy(tx,actor.companyId!);
  if(!settings.enabled)throw new Error("ITEMS_DISABLED");if(!settings.updateSalePrice)throw new Error("SALE_PRICE_UPDATE_DISABLED");
  const replay=await tx.accountOperationalAudit.findFirst({where:{companyId:actor.companyId,eventType:"SALE_MASTER_PRICE_CONFIRMED",metadata:{path:["requestKey"],equals:d.requestKey}}});
  if(replay){if((replay.metadata as Prisma.JsonObject)?.hash!==hash)throw new Error("IDEMPOTENCY_KEY_REUSED");return {updated:true};}
  if(doc.status!=="POSTED"||doc.journalEntry?.status!=="POSTED")throw new Error("SALE_PRICE_DOCUMENT_CHANGED");
  const p=await proposal(tx,actor,doc,d.lineId);if(!p)throw new Error("SALE_PRICE_ITEM_UNAVAILABLE");
  if(p.view.expectedUpdatedAt!==d.expectedUpdatedAt)throw new Error("SALE_PRICE_CHANGED");
  const existing={pricing:p.master.pricing,saleRate:p.product?.salePrice??p.service?.sellingRate??null,costRate:p.product?.costPrice??p.service?.estimatedCost??null,taxRate:p.master.taxRate};
  const kept=pricingForLegacyEdit(existing,{sellingRate:p.rate.toString(),taxRate:p.master.taxRate?.toString()},settings);
  const where={id:p.master.id,companyId:actor.companyId!,updatedAt:new Date(d.expectedUpdatedAt),isActive:true};
  const updated=p.product?await tx.accountProduct.updateMany({where,data:{salePrice:p.rate,...(kept?.pricing?{pricing:kept.pricing}:{})}}):await tx.accountService.updateMany({where,data:{sellingRate:p.rate,...(kept?.pricing?{pricing:kept.pricing}:{})}});
  if(updated.count!==1)throw new Error("SALE_PRICE_CHANGED");
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId!,actorUserId:actor.id,eventType:"SALE_MASTER_PRICE_CONFIRMED",entityType:p.product?"PRODUCT":"SERVICE",entityId:p.master.id,metadata:{...d,hash,oldPrice:p.view.oldPrice,newPrice:p.view.newPrice}}});
  return {updated:true};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
}
