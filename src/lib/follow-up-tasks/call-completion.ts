import {db} from "@/lib/db";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {operationalBranchContext} from "@/lib/branches/operational-scope";
import {decodeFollowUpNotes,encodeFollowUpNotes} from "./type";
import {FollowUpTaskError,syncLeadFollowUpAt,taskScope,type TaskActor} from "./service";

async function mutationActor():Promise<TaskActor>{
 const user=await requirePermissionForMutation("SALES_FOLLOW_UPS");
 if(!user.companyId||!user.salesRole)throw new FollowUpTaskError("NOT_FOUND");
 return{...user,companyId:user.companyId,salesRole:user.salesRole};
}

function outcomeNote(raw:unknown){
 const value=typeof raw==="string"?raw.trim():"";
 if(!value)throw new FollowUpTaskError("INVALID_STATE");
 return value.slice(0,1000);
}

export async function completeCallFollowUpTaskForActor(actor:TaskActor,taskId:string,rawOutcomeNote:unknown){
 await assertOperationalWrite(actor.companyId);
 const branches=await operationalBranchContext(actor),outcome=outcomeNote(rawOutcomeNote);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "follow_up_tasks" WHERE "id"=${taskId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const task=await tx.followUpTask.findFirst({where:{id:taskId,branchId:branches.branchId,...taskScope(actor)}});
  if(!task||task.assignedUserId!==actor.id)throw new FollowUpTaskError("NOT_FOUND");
  if(task.status!=="PENDING"||task.completedVisitId)throw new FollowUpTaskError("INVALID_STATE");
  const presentation=decodeFollowUpNotes(task.notes);
  if(presentation.type!=="CALL")throw new FollowUpTaskError("INVALID_TYPE");
  const notes=encodeFollowUpNotes("CALL",[presentation.notes,`Call outcome: ${outcome}`].filter(Boolean).join("\n"));
  await tx.followUpTask.update({where:{id:task.id},data:{status:"COMPLETED",completedAt:new Date(),notes}});
  await syncLeadFollowUpAt(tx,task.leadId);
  return{ok:true};
 });
}

export async function completeCallFollowUpTask(taskId:string,rawOutcomeNote:unknown){return completeCallFollowUpTaskForActor(await mutationActor(),taskId,rawOutcomeNote);}
