import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalesWorkspace, requireSalesWorkspaceForMutation } from "@/lib/auth/authorization";
import { visibilityWhere } from "@/lib/leads/policy";
import { assertActiveTelecallerEntitlement } from "@/lib/billing/telecaller";
import { isTelecaller, SALES_HANDOFF_RESULTS, TELECALLING_RESULTS, type TelecallingResult } from "./policy";

export type LeadCallHistoryItem={
 id:string; leadId:string; callerUserId:string; callerName:string; result:TelecallingResult; notes:string|null;
 calledAt:Date; nextCallbackAt:Date|null; callbackAssigneeUserId:string|null;
};
export type TelecallingQueueLead={
 id:string; title:string; contactName:string|null; phone:string|null; stage:string; assignedUserId:string; ownerName:string; calls:number;
};
export type CallbackQueueItem=LeadCallHistoryItem&{leadTitle:string;phone:string|null;ownerName:string};
export type SalesActionItem={
 id:string;leadId:string;leadTitle:string;phone:string|null;leadCallId:string;assignedUserId:string;ownerName:string;createdByUserId:string;callerName:string;
 trigger:"INTERESTED"|"WANTS_VISIT"|"WANTS_QUOTATION";status:"PENDING"|"ACKNOWLEDGED"|"ACTION_TAKEN";notes:string|null;calledAt:Date;createdAt:Date;
};

const indiaDayFormatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"});
function indiaDayKey(value:Date){
 const parts=Object.fromEntries(indiaDayFormatter.formatToParts(value).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}

function actorLeadWhere(actor:{id:string;companyId:string;salesRole:string|null;managerType?:string|null;designation?:string|null}){
 if(!actor.salesRole) return {id:"__none__"};
 if(isTelecaller(actor)) return {};
 return visibilityWhere({id:actor.id,salesRole:actor.salesRole as "PRIMARY_ADMIN"|"ADMIN"|"MANAGER"|"SALES",managerType:actor.managerType as never});
}

async function assertActorTelecallerEntitlement(actor:{companyId:string; salesRole:string|null; designation?:string|null}){
 if(isTelecaller(actor))await assertActiveTelecallerEntitlement(actor.companyId);
}

async function requireLeadAccess(leadId:string, mutation=false){
 const actor=mutation?await requireSalesWorkspaceForMutation():await requireSalesWorkspace();
 if(!actor.salesRole) throw new Error("NOT_AUTHORIZED");
 await assertActorTelecallerEntitlement(actor);
 const lead=await db.lead.findFirst({
  where:{id:leadId,companyId:actor.companyId,...actorLeadWhere(actor)},
  select:{id:true,companyId:true,title:true,phone:true,stage:true,assignedUserId:true,assignedUser:{select:{id:true,name:true,designation:true}}},
 });
 if(!lead)throw new Error("LEAD_NOT_FOUND");
 return {actor,lead};
}

function assertResult(value:string):TelecallingResult{
 if(!(TELECALLING_RESULTS as readonly string[]).includes(value))throw new Error("INVALID_CALL_RESULT");
 return value as TelecallingResult;
}

export function splitCallbackQueue(callbacks:CallbackQueueItem[],now=new Date()){
 const todayKey=indiaDayKey(now),nowMs=now.getTime();
 const overdue=callbacks.filter(x=>x.nextCallbackAt&&x.nextCallbackAt.getTime()<nowMs);
 const today=callbacks.filter(x=>x.nextCallbackAt&&x.nextCallbackAt.getTime()>=nowMs&&indiaDayKey(x.nextCallbackAt)===todayKey);
 const upcoming=callbacks.filter(x=>x.nextCallbackAt&&x.nextCallbackAt.getTime()>=nowMs&&indiaDayKey(x.nextCallbackAt)!==todayKey);
 return [["Overdue",overdue],["Today",today],["Upcoming",upcoming]] as const;
}

export async function listTelecallingLeads(search?:string):Promise<TelecallingQueueLead[]>{
 const actor=await requireSalesWorkspace();
 if(!actor.salesRole||!(isTelecaller(actor)||actor.salesRole==="PRIMARY_ADMIN"||actor.salesRole==="ADMIN"||actor.salesRole==="MANAGER"))throw new Error("NOT_AUTHORIZED");
 await assertActorTelecallerEntitlement(actor);
 const leads=await db.lead.findMany({
  where:{companyId:actor.companyId,...actorLeadWhere(actor),...(search?.trim()?{OR:[{title:{contains:search.trim(),mode:"insensitive"}},{contactName:{contains:search.trim(),mode:"insensitive"}},{phone:{contains:search.trim()}}]}:{})},
  select:{id:true,title:true,contactName:true,phone:true,stage:true,assignedUserId:true,assignedUser:{select:{name:true}}},
  orderBy:{updatedAt:"desc"},take:250,
 });
 const ids=leads.map(l=>l.id);
 const counts=ids.length?await db.$queryRaw<{leadId:string;count:bigint}[]>(Prisma.sql`SELECT "leadId", COUNT(*)::bigint AS count FROM "lead_calls" WHERE "companyId"=${actor.companyId}::uuid AND "leadId" IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) GROUP BY "leadId"`):[];
 const map=new Map(counts.map(x=>[x.leadId,Number(x.count)]));
 return leads.map(l=>({...l,stage:String(l.stage),ownerName:l.assignedUser.name,calls:map.get(l.id)??0}));
}

export async function leadCallCount(leadId:string){
 const {actor}=await requireLeadAccess(leadId);
 const rows=await db.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "lead_calls" WHERE "companyId"=${actor.companyId}::uuid AND "leadId"=${leadId}::uuid`);
 return Number(rows[0]?.count??0);
}

export async function getLeadCallHistory(leadId:string):Promise<LeadCallHistoryItem[]>{
 const {actor}=await requireLeadAccess(leadId);
 return db.$queryRaw<LeadCallHistoryItem[]>(Prisma.sql`
  SELECT c.id,c."leadId",c."callerUserId",u.name AS "callerName",c.result,c.notes,c."calledAt",c."nextCallbackAt",c."callbackAssigneeUserId"
  FROM "lead_calls" c JOIN "users" u ON u.id=c."callerUserId"
  WHERE c."companyId"=${actor.companyId}::uuid AND c."leadId"=${leadId}::uuid ORDER BY c."calledAt" DESC LIMIT 100`);
}

export async function recordLeadCall(input:{leadId:string;result:string;notes?:string|null;nextCallbackAt?:Date|null}){
 const {actor,lead}=await requireLeadAccess(input.leadId,true);
 const result=assertResult(input.result);
 const notes=input.notes?.trim()?.slice(0,2000)||null;
 const nextCallbackAt=result==="CALL_BACK"?input.nextCallbackAt??null:null;
 if(result==="CALL_BACK"&&!nextCallbackAt)throw new Error("CALLBACK_DATE_REQUIRED");
 if(nextCallbackAt&&nextCallbackAt.getTime()<=Date.now())throw new Error("CALLBACK_DATE_MUST_BE_FUTURE");
 const id=randomUUID();
 await db.$transaction(async tx=>{
  await tx.$executeRaw(Prisma.sql`INSERT INTO "lead_calls" (id,"companyId","leadId","callerUserId",result,notes,"calledAt","nextCallbackAt","callbackAssigneeUserId","createdAt","updatedAt") VALUES (${id}::uuid,${actor.companyId}::uuid,${lead.id}::uuid,${actor.id}::uuid,${result},${notes},NOW(),${nextCallbackAt},${nextCallbackAt?actor.id:null}::uuid,NOW(),NOW())`);
  if(SALES_HANDOFF_RESULTS.has(result)&&lead.assignedUserId!==actor.id){
   const actionId=randomUUID();
   await tx.$executeRaw(Prisma.sql`INSERT INTO "lead_sales_actions" (id,"companyId","leadId","leadCallId","assignedUserId","createdByUserId",trigger,status,"createdAt","updatedAt") VALUES (${actionId}::uuid,${actor.companyId}::uuid,${lead.id}::uuid,${id}::uuid,${lead.assignedUserId}::uuid,${actor.id}::uuid,${result},'PENDING',NOW(),NOW())`);
  }
 });
 return {id,result,handoffCreated:SALES_HANDOFF_RESULTS.has(result)&&lead.assignedUserId!==actor.id};
}

export async function listCallbackQueue():Promise<CallbackQueueItem[]>{
 const actor=await requireSalesWorkspace();
 if(!actor.salesRole||!(isTelecaller(actor)||actor.salesRole==="PRIMARY_ADMIN"||actor.salesRole==="ADMIN"||actor.salesRole==="MANAGER"))throw new Error("NOT_AUTHORIZED");
 await assertActorTelecallerEntitlement(actor);
 const ownOnly=isTelecaller(actor);
 const manager=actor.salesRole==="MANAGER";
 const rows=await db.$queryRaw<CallbackQueueItem[]>(Prisma.sql`
 SELECT c.id,c."leadId",c."callerUserId",u.name AS "callerName",c.result,c.notes,c."calledAt",c."nextCallbackAt",c."callbackAssigneeUserId",l.title AS "leadTitle",l.phone,owner.name AS "ownerName"
 FROM "lead_calls" c JOIN "leads" l ON l.id=c."leadId" JOIN "users" u ON u.id=c."callerUserId" JOIN "users" owner ON owner.id=l."assignedUserId"
 WHERE c."companyId"=${actor.companyId}::uuid AND c.result='CALL_BACK' AND c."nextCallbackAt" IS NOT NULL
 ${ownOnly?Prisma.sql`AND c."callbackAssigneeUserId"=${actor.id}::uuid`:Prisma.empty}
 ${manager?Prisma.sql`AND (l."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)`:Prisma.empty}
 AND NOT EXISTS (SELECT 1 FROM "lead_calls" n WHERE n."companyId"=c."companyId" AND n."leadId"=c."leadId" AND n."callerUserId"=c."callbackAssigneeUserId" AND n."calledAt">c."calledAt")
 ORDER BY c."nextCallbackAt" ASC LIMIT 500`);
 return rows;
}

export async function listSalesActions():Promise<SalesActionItem[]>{
 const actor=await requireSalesWorkspace();
 if(!actor.salesRole||isTelecaller(actor))return [];
 const admin=actor.salesRole==="PRIMARY_ADMIN"||actor.salesRole==="ADMIN";
 const manager=actor.salesRole==="MANAGER";
 return db.$queryRaw<SalesActionItem[]>(Prisma.sql`
 SELECT a.id,a."leadId",l.title AS "leadTitle",l.phone,a."leadCallId",a."assignedUserId",owner.name AS "ownerName",a."createdByUserId",caller.name AS "callerName",a.trigger,a.status,c.notes,c."calledAt",a."createdAt"
 FROM "lead_sales_actions" a JOIN "lead_calls" c ON c.id=a."leadCallId" JOIN "leads" l ON l.id=a."leadId" JOIN "users" owner ON owner.id=a."assignedUserId" JOIN "users" caller ON caller.id=a."createdByUserId"
 WHERE a."companyId"=${actor.companyId}::uuid
 ${admin?Prisma.empty:manager?Prisma.sql`AND (a."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)`:Prisma.sql`AND a."assignedUserId"=${actor.id}::uuid`}
 ORDER BY CASE a.status WHEN 'PENDING' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 ELSE 2 END,a."createdAt" DESC LIMIT 250`);
}

export async function updateSalesAction(id:string,status:"ACKNOWLEDGED"|"ACTION_TAKEN"){
 const actor=await requireSalesWorkspaceForMutation();
 if(!actor.salesRole||isTelecaller(actor))throw new Error("NOT_AUTHORIZED");
 const rows=await db.$queryRaw<{id:string;assignedUserId:string;ownerManagerId:string|null}[]>(Prisma.sql`SELECT a.id,a."assignedUserId",owner."managerId" AS "ownerManagerId" FROM "lead_sales_actions" a JOIN "users" owner ON owner.id=a."assignedUserId" WHERE a.id=${id}::uuid AND a."companyId"=${actor.companyId}::uuid LIMIT 1`);
 const row=rows[0]; if(!row)throw new Error("NOT_FOUND");
 const supervisor=actor.salesRole==="PRIMARY_ADMIN"||actor.salesRole==="ADMIN"||(actor.salesRole==="MANAGER"&&(row.assignedUserId===actor.id||row.ownerManagerId===actor.id));
 if(row.assignedUserId!==actor.id&&!supervisor)throw new Error("NOT_AUTHORIZED");
 await db.$executeRaw(Prisma.sql`UPDATE "lead_sales_actions" SET status=${status},"acknowledgedAt"=CASE WHEN ${status}='ACKNOWLEDGED' AND "acknowledgedAt" IS NULL THEN NOW() ELSE "acknowledgedAt" END,"actionedAt"=CASE WHEN ${status}='ACTION_TAKEN' THEN NOW() ELSE "actionedAt" END,"updatedAt"=NOW() WHERE id=${id}::uuid AND "companyId"=${actor.companyId}::uuid`);
}
