import {createHash,randomUUID} from "node:crypto";
import sharp from "sharp";
import {z} from "zod";
import {db} from "@/lib/db";
import {privateStorage} from "@/lib/storage";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {attachmentDisplayName} from "./attachment-name";
import type {ProjectActor} from "./projects";
export async function prepareTransferImage(file:File){
 if(!file.size||file.size>5*1024*1024||!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("INVALID_TRANSFER_IMAGE");
 let data:Buffer;try{data=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:40_000_000}).rotate().resize({width:4096,height:4096,fit:"inside",withoutEnlargement:true}).png().toBuffer();}catch{throw new Error("INVALID_TRANSFER_IMAGE");}
 if(data.length>5*1024*1024)throw new Error("INVALID_TRANSFER_IMAGE");
 return{data,name:attachmentDisplayName(file.name).replace(/\.[^.]*$/,"").slice(0,236)+".png",hash:createHash("sha256").update(data).digest("hex")};
}
async function scopedTransfer(a:ProjectActor,id:string,write=false){
 if(!canUsePermission(a,"SALESPUNCH360_ACCOUNT",write?"ACCOUNT_MONEY_ENTRY":"ACCOUNT_MONEY_VIEW"))throw new AuthorizationError();
 if(!z.string().guid().safeParse(id).success)throw new Error("TRANSFER_NOT_FOUND");
 const row=await db.moneyTransfer.findFirst({where:{id,companyId:a.companyId,...(a.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:a.branchIds??[]}}:{})},select:{id:true}});
 if(!row)throw new Error("TRANSFER_NOT_FOUND");return row;
}
/** One immutable image per posted transfer. A retry never reposts financial entries. */
export async function addTransferImageForActor(a:ProjectActor,id:string,image:Awaited<ReturnType<typeof prepareTransferImage>>){
 await scopedTransfer(a,id,true);
 const old=await db.moneyTransferImage.findUnique({where:{transferId:id}});
 if(old){if(old.companyId!==a.companyId||old.contentHash!==image.hash)throw new Error("TRANSFER_IMAGE_ALREADY_ATTACHED");return old.id;}
 const imageId=randomUUID(),key=`companies/${a.companyId}/money-transfers/${id}/${imageId}`;
 try{
  await privateStorage().put(key,image.data);
  const saved=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"transfer-image:"+a.companyId+":"+id}))`;
   const existing=await tx.moneyTransferImage.findUnique({where:{transferId:id}});
   if(existing){if(existing.companyId!==a.companyId||existing.contentHash!==image.hash)throw new Error("TRANSFER_IMAGE_ALREADY_ATTACHED");return existing;}
   const row=await tx.moneyTransferImage.create({data:{id:imageId,companyId:a.companyId,transferId:id,storageKey:key,displayName:image.name,mimeType:"image/png",sizeBytes:image.data.length,contentHash:image.hash,uploadedById:a.id}});
   await tx.accountOperationalAudit.create({data:{companyId:a.companyId,actorUserId:a.id,eventType:"TRANSFER_IMAGE_ADDED",entityType:"MONEY_TRANSFER",entityId:id,metadata:{imageId}}});return row;
  });
  if(saved.storageKey!==key)await privateStorage().delete(key).catch(()=>undefined);
  return saved.id;
 }catch(error){await privateStorage().delete(key).catch(()=>undefined);throw error;}
}
export async function transferImageForActor(a:ProjectActor,id:string){
 await scopedTransfer(a,id);
 const row=await db.moneyTransferImage.findFirst({where:{companyId:a.companyId,transferId:id}});if(!row)throw new Error("TRANSFER_IMAGE_NOT_FOUND");
 return{data:await privateStorage().get(row.storageKey),name:row.displayName,mimeType:row.mimeType};
}
/** JSON transport for native clients; reject oversized/noncanonical base64 before decoding. */
export async function prepareTransferImagePayload(raw:unknown){
 if(raw===undefined)return null;
 const value=z.object({name:z.string().max(240),mimeType:z.enum(["image/png","image/jpeg","image/webp"]),base64:z.string().max(7_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).parse(raw);
 const bytes=Buffer.from(value.base64,"base64");if(bytes.toString("base64")!==value.base64||bytes.length>5*1024*1024)throw new Error("INVALID_TRANSFER_IMAGE");
 return prepareTransferImage(new File([new Uint8Array(bytes)],value.name,{type:value.mimeType}));
}
