import {createHash,randomUUID} from "node:crypto";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {ACCOUNT_ROLE_PERMISSIONS} from "@/lib/auth/permissions";
import {privateStorage} from "@/lib/storage";
import {expenseItemPhoto} from "./expense-items";
import {assertInventoryAvailable} from "./inventory";
import {retrySerializable} from "./transaction-retry";
import type {ProjectActor} from "./projects";
const identity=z.object({kind:z.enum(["products","services"]),id:z.string().uuid()}).strict();
async function access(actor:ProjectActor){
 if(!actor.companyId||!actor.accountRole||!ACCOUNT_ROLE_PERMISSIONS[actor.accountRole]?.includes("ACCOUNT_STOCK"))throw new AuthorizationError();
 await assertInventoryAvailable(actor);
}
export async function saveItemPhotoForActor(actor:ProjectActor,raw:unknown,file:File){
 await access(actor);const {kind,id}=identity.parse(raw);
 const where={id,companyId:actor.companyId,isActive:true};
 const found=kind==="products"?await db.accountProduct.findFirst({where,select:{id:true}}):await db.accountService.findFirst({where,select:{id:true}});
 if(!found)throw new Error("ITEM_PHOTO_NOT_FOUND");
 const bytes=await expenseItemPhoto(file).catch(()=>{throw new Error("INVALID_ITEM_PHOTO")});
 const hash=createHash("sha256").update(bytes).digest("hex"),prefix=`companies/${actor.companyId}/item-photos/`;
 const key=`${prefix}${kind}/${id}/${randomUUID()}-${hash}.webp`,storage=privateStorage();
 let retained=false,oldKey:string|null=null;
 try{
  await storage.put(key,bytes);
  const previous=await retrySerializable(()=>db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
   const current=kind==="products"?await tx.accountProduct.findFirst({where,select:{photoObjectKey:true}}):await tx.accountService.findFirst({where,select:{photoObjectKey:true}});
   if(!current)throw new Error("ITEM_PHOTO_NOT_FOUND");
   if(current.photoObjectKey?.startsWith(prefix)&&current.photoObjectKey.endsWith(`-${hash}.webp`))return;
   if(kind==="products")await tx.accountProduct.update({where:{companyId_id:{companyId:actor.companyId!,id}},data:{photoObjectKey:key}});
   else await tx.accountService.update({where:{companyId_id:{companyId:actor.companyId!,id}},data:{photoObjectKey:key}});
   await tx.accountOperationalAudit.create({data:{companyId:actor.companyId!,actorUserId:actor.id,eventType:"ITEM_PHOTO_SAVED",entityType:kind==="products"?"ACCOUNT_PRODUCT":"ACCOUNT_SERVICE",entityId:id,metadata:{sha256:hash}}});
   return current.photoObjectKey;
  },{isolationLevel:"Serializable"}));
  if(previous!==undefined){retained=true;oldKey=previous}
 } finally {if(!retained)await storage.delete(key).catch(()=>{});}
 if(oldKey?.startsWith(prefix))await storage.delete(oldKey).catch(()=>{});
 return {id,hasPhoto:true};
}
export async function itemPhotoForActor(actor:ProjectActor,raw:unknown){
 await access(actor);const {kind,id}=identity.parse(raw),where={id,companyId:actor.companyId,isActive:true};
 const row=kind==="products"?await db.accountProduct.findFirst({where,select:{photoObjectKey:true}}):await db.accountService.findFirst({where,select:{photoObjectKey:true}});
 if(!row?.photoObjectKey?.startsWith(`companies/${actor.companyId}/item-photos/${kind}/${id}/`))throw new Error("ITEM_PHOTO_NOT_FOUND");
 return privateStorage().get(row.photoObjectKey);
}
