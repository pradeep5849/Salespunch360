import type {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {requireSalesWorkspace,requireSalesWorkspaceForMutation} from "@/lib/auth/authorization";
import {isTelecaller} from "@/lib/telecalling/policy";
import {indiaDateText,parseIndiaBusinessDate} from "@/lib/follow-up-tasks/date";

export const FOLLOW_UP_DUE_SOON_DAYS=1;
export type SalesNotificationInput={companyId:string;recipientUserId:string;actorUserId?:string|null;eventType:string;title:string;body:string;relatedEntityType?:string;relatedEntityId?:string;navigationTarget?:string;dedupeKey:string};
type NotificationTx=Pick<Prisma.TransactionClient,"salesNotification"|"user">;

/** Recipient/company validation and the unique recipient+event key make event creation tenant-safe and retry-safe. */
export async function createSalesNotification(tx:NotificationTx,input:SalesNotificationInput){
 const recipient=await tx.user.findFirst({where:{id:input.recipientUserId,companyId:input.companyId,isActive:true,salesAccessActive:true},select:{id:true}});
 if(!recipient)return null;
 return tx.salesNotification.upsert({where:{recipientUserId_dedupeKey:{recipientUserId:input.recipientUserId,dedupeKey:input.dedupeKey}},create:{...input,actorUserId:input.actorUserId??null},update:{}});
}

export async function notifySalesAdmins(tx:NotificationTx,input:Omit<SalesNotificationInput,"recipientUserId">){
 const recipients=await tx.user.findMany({where:{companyId:input.companyId,isActive:true,salesAccessActive:true,salesRole:{in:["PRIMARY_ADMIN","ADMIN"]}},select:{id:true}});
 return Promise.all(recipients.map(({id})=>createSalesNotification(tx,{...input,recipientUserId:id})));
}

export async function listSalesNotificationsForActor(actor:{id:string;companyId:string},take=50){
 const where={companyId:actor.companyId,recipientUserId:actor.id};
 const [items,unreadCount]=await Promise.all([db.salesNotification.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:Math.min(Math.max(take,1),100)}),db.salesNotification.count({where:{...where,readAt:null}})]);
 return{items,unreadCount};
}
export async function listSalesNotifications(){const actor=await requireSalesWorkspace();return listSalesNotificationsForActor(actor);}
export async function markSalesNotificationRead(id:string){const actor=await requireSalesWorkspaceForMutation();return db.salesNotification.updateMany({where:{id,companyId:actor.companyId,recipientUserId:actor.id,readAt:null},data:{readAt:new Date()}});}
export async function markAllSalesNotificationsRead(){const actor=await requireSalesWorkspaceForMutation();return db.salesNotification.updateMany({where:{companyId:actor.companyId,recipientUserId:actor.id,readAt:null},data:{readAt:new Date()}});}

/** Idempotent reminder sweep. It may safely be invoked repeatedly by the existing maintenance runner. */
export async function generateFollowUpReminders(now=new Date()){
 const today=parseIndiaBusinessDate(indiaDateText(now));
 const soonEnd=new Date(today.getTime()+(FOLLOW_UP_DUE_SOON_DAYS+1)*86_400_000);
 const tasks=await db.followUpTask.findMany({where:{status:"PENDING",dueDate:{lt:soonEnd}},select:{id:true,companyId:true,assignedUserId:true,dueDate:true,lead:{select:{id:true,title:true}},assignedUser:{select:{designation:true,salesRole:true,managerId:true}}},take:1000});
 let created=0;
 for(const task of tasks){
  const overdue=task.dueDate<today,eventType=overdue?"FOLLOW_UP_OVERDUE":"FOLLOW_UP_DUE_SOON",dateKey=indiaDateText(task.dueDate);
  const recipients=new Set<string>([task.assignedUserId]);
  const admins=await db.user.findMany({where:{companyId:task.companyId,isActive:true,salesAccessActive:true,salesRole:{in:["PRIMARY_ADMIN","ADMIN"]}},select:{id:true}});
  admins.forEach(x=>recipients.add(x.id));
  if(overdue&&task.assignedUser.managerId)recipients.add(task.assignedUser.managerId);
  for(const recipientUserId of recipients){const result=await createSalesNotification(db,{companyId:task.companyId,recipientUserId,eventType,title:overdue?"Follow-up overdue":"Follow-up due soon",body:`${task.lead.title} is ${overdue?"overdue":`due on ${dateKey}`}.`,relatedEntityType:"FOLLOW_UP",relatedEntityId:task.id,navigationTarget:`/workspace/follow-up-tasks?leadId=${task.lead.id}`,dedupeKey:`${eventType}:${task.id}:${dateKey}`});if(result)created++;}
 }
 return{processed:tasks.length,created};
}

export function telecallerMayReceive(eventType:string,user:{salesRole:string|null;designation?:string|null}){
 return !isTelecaller(user)||["FOLLOW_UP_ASSIGNED","FOLLOW_UP_DUE_SOON","FOLLOW_UP_OVERDUE","FOLLOW_UP_RESCHEDULED","FOLLOW_UP_CANCELLED","FOLLOW_UP_REASSIGNED_AWAY"].includes(eventType);
}
