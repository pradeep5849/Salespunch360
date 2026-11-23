import type { Prisma } from "@prisma/client";
import { encodeFollowUpNotes } from "@/lib/follow-up-tasks/type";
import { indiaDateText, parseIndiaBusinessDate } from "@/lib/follow-up-tasks/date";
import { syncLeadFollowUpAt } from "@/lib/follow-up-tasks/service";
import { createSalesNotification } from "@/lib/sales-notifications/service";
/** Serialize Call outcomes per lead, then complete only this caller's source callbacks.
 * Explicit assigned Call tasks are completed by the existing assignee-only handler. */
export async function lockCallbackLead(tx:Prisma.TransactionClient,companyId:string,leadId:string) {
 await tx.$queryRaw`SELECT id FROM leads WHERE id=${leadId}::uuid AND "companyId"=${companyId}::uuid FOR UPDATE`;
}
export async function reconcileCallbackTasksInTx(tx:Prisma.TransactionClient,input:{companyId:string;leadId:string;callerId:string;callId:string;nextCallbackAt:Date|null;notes:string|null}) {
 const lead=await tx.lead.findFirst({where:{id:input.leadId,companyId:input.companyId},select:{branchId:true}});
 if(!lead?.branchId) throw new Error("NOT_FOUND");
 await tx.followUpTask.updateMany({where:{companyId:input.companyId,leadId:input.leadId,assignedUserId:input.callerId,status:"PENDING",callbackCallId:{not:null}},data:{status:"COMPLETED",completedAt:new Date()}});
 if(input.nextCallbackAt){
  const task=await tx.followUpTask.create({data:{companyId:input.companyId,branchId:lead.branchId,leadId:input.leadId,assignedUserId:input.callerId,createdByUserId:input.callerId,dueDate:parseIndiaBusinessDate(indiaDateText(input.nextCallbackAt)),callbackAt:input.nextCallbackAt,callbackCallId:input.callId,notes:encodeFollowUpNotes("CALL",input.notes)}});
  await createSalesNotification(tx,{companyId:input.companyId,recipientUserId:input.callerId,actorUserId:input.callerId,eventType:"FOLLOW_UP_ASSIGNED",title:"Callback scheduled",body:"Your Call follow-up has been scheduled.",relatedEntityType:"FOLLOW_UP",relatedEntityId:task.id,navigationTarget:`/workspace/follow-up-tasks?status=PENDING&leadId=${input.leadId}`,dedupeKey:`FOLLOW_UP_ASSIGNED:${task.id}`});
 }
 await syncLeadFollowUpAt(tx,input.leadId);
}
