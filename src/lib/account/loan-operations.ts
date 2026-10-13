import {createHash} from "node:crypto";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {retrySerializable} from "./transaction-retry";
import {loanCreationFingerprint} from "./loan-fingerprint";
import type {ProjectActor} from "./projects";
const blank=(v:unknown)=>typeof v==="string"&&v.trim()===""?null:v;
const text=(max:number)=>z.preprocess(blank,z.string().trim().max(max).nullable().optional());
export const loanMetadataInput=z.object({
 requestKey:z.string().uuid(),expectedVersion:z.coerce.number().int().min(0).max(2147483646),
 displayName:text(240),loanAccountNumber:text(160),description:text(2000),
 durationMonths:z.preprocess(blank,z.coerce.number().int().min(1).max(1200).nullable().optional()),
}).strict();
export async function editLoanMetadataForActor(actor:ProjectActor,id:string,raw:unknown){
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LOAN_ADMIN"))throw new AuthorizationError();
 z.string().uuid().parse(id);const d=loanMetadataInput.parse(raw);const {requestKey,expectedVersion,...patch}=d;
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM loans WHERE id=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const before=await tx.loan.findFirst({where:{id,companyId:actor.companyId}});
  if(!before||actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(before.branchId))throw new AuthorizationError();
  const hash=createHash("sha256").update(JSON.stringify({action:"EDIT_METADATA",loanId:before.id,expectedVersion,patch})).digest("hex");
  const prior=await tx.loanOperation.findFirst({where:{companyId:actor.companyId,requestKey}});
  if(prior){if(prior.loanId!==before.id||prior.requestHash!==hash)throw new Error("IDEMPOTENCY_CONFLICT");return before;}
  if(before.version!==expectedVersion)throw new Error("LOAN_CHANGED");
  const after=await tx.loan.update({where:{id:before.id},data:{...patch,version:{increment:1},creationRequestHash:before.creationRequestHash??loanCreationFingerprint(before)}});
  const snapshot=(row:typeof before)=>({displayName:row.displayName,loanAccountNumber:row.loanAccountNumber,description:row.description,durationMonths:row.durationMonths});
  const metadata={before:snapshot(before),after:snapshot(after)};
  await tx.loanOperation.create({data:{companyId:actor.companyId,loanId:before.id,action:"EDIT_METADATA",requestKey,requestHash:hash,expectedVersion,resultingVersion:after.version,createdById:actor.id,metadata}});
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"LOAN_METADATA_EDITED",entityType:"LOAN",entityId:before.id,metadata:{...metadata,requestKey}}});
  return after;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}),3,["companyId","requestKey"]);
}
