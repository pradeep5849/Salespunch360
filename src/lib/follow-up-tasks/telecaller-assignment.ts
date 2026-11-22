import {createSalesNotification} from "@/lib/sales-notifications/service";
import {Prisma,type ManagerType,type SalesRole} from "@prisma/client";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth/authorization";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {assertActiveTelecallerEntitlement} from "@/lib/billing/telecaller";
import {canAssign,visibilityWhere} from "@/lib/leads/policy";
import {operationalBranchContext,resolveOperationalWriteBranch,type OperationalActor} from "@/lib/branches/operational-scope";
import {parseIndiaBusinessDate} from "./date";
import {decodeFollowUpNotes,encodeFollowUpNotes} from "./type";
import {syncLeadFollowUpAt} from "./service";
import {isTelecaller} from "@/lib/telecalling/policy";

export type CallAssignmentActor={
 id:string;companyId:string;salesRole:SalesRole;managerType?:ManagerType|null;designation?:string|null;
 branchAccessScope?:"ALL_BRANCHES"|"SELECTED_BRANCHES";branchIds?:string[];
};
export type TelecallerOption={id:string;name:string};
export type AssignedTelecallerCall={
 id:string;followUpTaskId:string;leadId:string;callerUserId:string;callerName:string;result:"CALL_BACK";notes:string|null;
 calledAt:Date;nextCallbackAt:Date;callbackAssigneeUserId:string;leadTitle:string;phone:string|null;ownerName:string;assigneeName:string;
};

const designationSql=Prisma.sql`upper(replace(coalesce(designation,''),' ',''))='TELECALLER'`;

export async function telecallerOptionsForCompany(companyId:string):Promise<TelecallerOption[]>{
 try{await assertActiveTelecallerEntitlement(companyId);}catch{return[];}
 return db.$queryRaw<TelecallerOption[]>(Prisma.sql`
  SELECT id,name FROM "users"
  WHERE "companyId"=${companyId}::uuid AND "isActive"=TRUE AND "salesRole"='SALES'::"SalesRole" AND ${designationSql}
  ORDER BY name ASC LIMIT 100`);
}

export async function telecallerFollowUpOptions():Promise<TelecallerOption[]>{
 const actor=await requirePermission("SALES_FOLLOW_UPS");
 if(!actor.companyId||!actor.salesRole)return[];
 return telecallerOptionsForCompany(actor.companyId);
}

export async function createTelecallerCallFollowUpForActor(actor:CallAssignmentActor,raw:{leadId:unknown;dueDate:unknown;notes?:unknown;assignedUserId:unknown}){
 await assertOperationalWrite(actor.companyId);
 await assertActiveTelecallerEntitlement(actor.companyId);
 const leadId=String(raw.leadId),assignedUserId=String(raw.assignedUserId),dueText=String(raw.dueDate);
 let dueDate:Date;try{dueDate=parseIndiaBusinessDate(dueText);}catch{throw new Error("INVALID_DATE");}
 const notes=encodeFollowUpNotes("CALL",raw.notes);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "leads" WHERE "id"=${leadId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const lead=await tx.lead.findFirst({where:{id:leadId,companyId:actor.companyId,...visibilityWhere(actor)},select:{id:true,branchId:true,assignedUserId:true,assignedUser:{select:{id:true,salesRole:true,isActive:true,salesAccessActive:true,managerId:true,managerType:true}}}});
  if(!lead)throw new Error("NOT_FOUND");
  await resolveOperationalWriteBranch(actor,lead.branchId,tx);
  if(!canAssign(actor,lead.assignedUser))throw new Error("INVALID_ASSIGNMENT");
  const target=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM "users" WHERE id=${assignedUserId}::uuid AND "companyId"=${actor.companyId}::uuid AND "isActive"=TRUE AND "salesRole"='SALES'::"SalesRole" AND ${designationSql} LIMIT 1`);
  if(!target[0])throw new Error("INVALID_ASSIGNMENT");
  const task=await tx.followUpTask.create({data:{companyId:actor.companyId,branchId:lead.branchId,leadId,assignedUserId,createdByUserId:actor.id,dueDate,notes}});
  await syncLeadFollowUpAt(tx,leadId);
  await createSalesNotification(tx,{companyId:actor.companyId,recipientUserId:assignedUserId,actorUserId:actor.id,eventType:"FOLLOW_UP_ASSIGNED",title:"Call follow-up assigned",body:"A Call follow-up was assigned to you.",relatedEntityType:"FOLLOW_UP",relatedEntityId:task.id,navigationTarget:`/workspace/follow-up-tasks?status=PENDING&leadId=${leadId}`,dedupeKey:`FOLLOW_UP_ASSIGNED:${task.id}`});
  return{...task,type:"CALL" as const,notes:decodeFollowUpNotes(task.notes).notes};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function listAssignedTelecallerCallsForActor(actor:CallAssignmentActor):Promise<AssignedTelecallerCall[]>{
 const telecaller=isTelecaller(actor),admin=actor.salesRole==="PRIMARY_ADMIN"||actor.salesRole==="ADMIN",manager=actor.salesRole==="MANAGER";
 if(!telecaller&&!admin&&!manager)return[];
 const rows=await db.$queryRaw<(AssignedTelecallerCall&{rawNotes:string|null})[]>(Prisma.sql`
  SELECT t.id,t.id AS "followUpTaskId",t."leadId",t."createdByUserId" AS "callerUserId",creator.name AS "callerName",
   'CALL_BACK'::text AS result,t.notes AS "rawNotes",t."createdAt" AS "calledAt",t."dueDate" AS "nextCallbackAt",t."assignedUserId" AS "callbackAssigneeUserId",
   l.title AS "leadTitle",l.phone,owner.name AS "ownerName",assignee.name AS "assigneeName"
  FROM "follow_up_tasks" t
  JOIN "leads" l ON l.id=t."leadId"
  JOIN "users" owner ON owner.id=l."assignedUserId"
  JOIN "users" assignee ON assignee.id=t."assignedUserId"
  JOIN "users" creator ON creator.id=t."createdByUserId"
  WHERE t."companyId"=${actor.companyId}::uuid AND t.status='PENDING' AND t.notes LIKE '[[SP360_FOLLOW_UP:CALL]]%'
   AND upper(replace(coalesce(assignee.designation,''),' ',''))='TELECALLER' AND assignee."isActive"=TRUE
   ${telecaller?Prisma.sql`AND t."assignedUserId"=${actor.id}::uuid`:Prisma.empty}
   ${manager?Prisma.sql`AND (l."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)`:Prisma.empty}
  ORDER BY t."dueDate" ASC LIMIT 500`);
 return rows.map(row=>({...row,notes:decodeFollowUpNotes(row.rawNotes).notes}));
}

export async function completeAssignedTelecallerCallInTx(tx:Prisma.TransactionClient,actor:OperationalActor,taskId:string,leadId:string){
 const branches=await operationalBranchContext(actor,undefined,tx);
 await tx.$queryRaw`SELECT "id" FROM "follow_up_tasks" WHERE "id"=${taskId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
 const task=await tx.followUpTask.findFirst({where:{id:taskId,companyId:actor.companyId,branchId:branches.branchId,leadId,assignedUserId:actor.id},select:{id:true,leadId:true,status:true,notes:true,completedVisitId:true}});
 if(!task)throw new Error("NOT_FOUND");
 if(task.status!=="PENDING"||task.completedVisitId||decodeFollowUpNotes(task.notes).type!=="CALL")throw new Error("INVALID_STATE");
 await tx.followUpTask.update({where:{id:task.id},data:{status:"COMPLETED",completedAt:new Date()}});
 await syncLeadFollowUpAt(tx,leadId);
}
export async function completeAssignedTelecallerCallForActor(actor:OperationalActor,taskId:string,leadId:string){
 return db.$transaction(tx=>completeAssignedTelecallerCallInTx(tx,actor,taskId,leadId));
}
