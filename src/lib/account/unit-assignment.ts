import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {assertUnitAccess} from "./units";
import {unitSchema} from "./validation";
import {retrySerializable} from "./transaction-retry";
import type {ProjectActor} from "./projects";
export const unitAssignmentInput=z.object({kind:z.enum(["PRODUCT","SERVICE"]),itemIds:z.array(z.string().uuid()).min(1).max(200),unitId:z.string().uuid().optional(),newUnit:unitSchema.strict().optional()}).strict().refine(x=>Boolean(x.unitId)!==Boolean(x.newUnit),"Select an existing unit or create one");
/** A base-unit change cannot reinterpret quantities already recorded against an item. */
async function assertItemsHaveNoUnitHistory(tx:Prisma.TransactionClient,companyId:string,kind:"PRODUCT"|"SERVICE",ids:string[]){
 if(!ids.length)return;
 const historyWhere={companyId,...(kind==="PRODUCT"?{productId:{in:ids}}:{serviceId:{in:ids}})};
 const [stock,commercial,quotations]=await Promise.all([
  kind==="PRODUCT"?tx.stockMovement.findFirst({where:{companyId,productId:{in:ids}},select:{id:true}}):Promise.resolve(null),
  tx.commercialDocumentLine.findFirst({where:historyWhere,select:{id:true}}),
  tx.quotationLine.findFirst({where:historyWhere,select:{id:true}}),
 ]);
 if(stock||commercial||quotations)throw new Error("UNIT_HAS_TRANSACTION_HISTORY");
}
export async function assertItemUnitChangeInTx(tx:Prisma.TransactionClient,companyId:string,kind:"PRODUCT"|"SERVICE",id:string,previous:string|null,next:string|null){if(previous!==next)await assertItemsHaveNoUnitHistory(tx,companyId,kind,[id]);}
export async function assignUnitToItemsForActor(actor:ProjectActor,raw:unknown){
 await assertUnitAccess(actor);const d=unitAssignmentInput.parse(raw),ids=[...new Set(d.itemIds)].sort();
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId+":account-settings"}))`;
  await assertUnitAccess(actor,tx);
  let unit=d.unitId?await tx.accountUnit.findFirst({where:{id:d.unitId,companyId:actor.companyId,isActive:true}}):null;
  if(d.newUnit){
   const existing=await tx.accountUnit.findFirst({where:{companyId:actor.companyId,OR:[{name:d.newUnit.name},{symbol:d.newUnit.symbol}]}});
   if(existing&&(existing.name!==d.newUnit.name||existing.symbol!==d.newUnit.symbol||!existing.isActive))throw new Error("UNIT_NAME_OR_SYMBOL_EXISTS");
   unit=existing??await tx.accountUnit.create({data:{companyId:actor.companyId,...d.newUnit}});
   if(!existing)await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"UNIT_CREATED",entityType:"UNIT",entityId:unit.id,metadata:{after:d.newUnit}}});
  }
  if(!unit)throw new Error("INVALID_UNIT");
  const where={companyId:actor.companyId,id:{in:ids},isActive:true};
  const items=d.kind==="PRODUCT"?await tx.accountProduct.findMany({where,select:{id:true,unitId:true}}):await tx.accountService.findMany({where,select:{id:true,unitId:true}});
  if(items.length!==ids.length)throw new AuthorizationError();
  const changed=items.filter(item=>item.unitId!==unit.id);
  await assertItemsHaveNoUnitHistory(tx,actor.companyId,d.kind,changed.map(item=>item.id));
  if(changed.length){
   const changedWhere={...where,id:{in:changed.map(item=>item.id)}};
   const updated=d.kind==="PRODUCT"?await tx.accountProduct.updateMany({where:changedWhere,data:{unitId:unit.id}}):await tx.accountService.updateMany({where:changedWhere,data:{unitId:unit.id}});
   if(updated.count!==changed.length)throw new AuthorizationError();
   await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"ITEM_UNITS_ASSIGNED",entityType:d.kind,entityId:unit.id,metadata:{items:changed.map(item=>({id:item.id,beforeUnitId:item.unitId,afterUnitId:unit.id}))}}});
  }
  const affected=[...new Set([unit.id,...changed.map(item=>item.unitId).filter((id):id is string=>!!id)])];
  const counters=await tx.accountUnit.findMany({where:{companyId:actor.companyId,id:{in:affected},isActive:true},select:{id:true,name:true,symbol:true,_count:{select:{products:true,services:true}}}});
  return {count:items.length,changedCount:changed.length,units:counters.map(row=>({id:row.id,name:row.name,symbol:row.symbol,itemCount:row._count.products+row._count.services}))};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}),3,["companyId","name"]);
}
const query=z.object({kind:z.enum(["PRODUCT","SERVICE"]),q:z.string().trim().max(160).default(""),offset:z.coerce.number().int().min(0).max(1000000).default(0),limit:z.coerce.number().int().min(1).max(100).default(50)}).strict();
export async function unitAssignmentOptionsForActor(actor:ProjectActor,raw:unknown){
 await assertUnitAccess(actor);const f=query.parse(raw);const where={companyId:actor.companyId,isActive:true,...(f.q?{OR:[{name:{contains:f.q,mode:"insensitive" as const}},{code:{contains:f.q,mode:"insensitive" as const}}]}:{})};
 const args={where,orderBy:[{name:"asc" as const},{id:"asc" as const}],skip:f.offset,take:f.limit+1,select:{id:true,name:true,code:true,unitId:true}};
 const found=f.kind==="PRODUCT"?await db.accountProduct.findMany(args):await db.accountService.findMany(args);
 return {items:found.slice(0,f.limit),offset:f.offset,nextOffset:found.length>f.limit?f.offset+f.limit:null};
}
