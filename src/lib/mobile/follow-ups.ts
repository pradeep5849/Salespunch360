import type {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {indiaDateText,parseIndiaBusinessDate} from '@/lib/follow-up-tasks/date';
import {mobileCan,mobileFieldWorkEnabled,type MobilePrincipal} from './auth';
import {mobileReportActor} from './report-actor';
import {reportEmployeeOptions,resolveEmployeeScope} from '@/lib/reports/scope';

const allowedStatuses=['TODAY','OVERDUE','PENDING','COMPLETED','CANCELLED'] as const;
type MobileFollowUpStatus=(typeof allowedStatuses)[number];

export async function mobileFollowUps(user:MobilePrincipal,rawStatus:string|null,rawEmployeeId:string|null=null){
 if(user.salesRole==='SALES'? !mobileCan(user,'SALES_FOLLOW_UPS'):!mobileCan(user,'SALES_REPORTS'))throw new Error('FORBIDDEN');
 const branches=await operationalBranchContext(user),today=parseIndiaBusinessDate(indiaDateText()),tomorrow=new Date(today.getTime()+86_400_000);
 const actor=mobileReportActor(user),employees=user.salesRole==='SALES'?[]:await reportEmployeeOptions(actor),employeeId=user.salesRole==='SALES'?user.id:rawEmployeeId??undefined,userIds=await resolveEmployeeScope(actor,employeeId);
 const status:MobileFollowUpStatus=allowedStatuses.includes(rawStatus as MobileFollowUpStatus)?rawStatus as MobileFollowUpStatus:'TODAY';
 const statusWhere:Prisma.FollowUpTaskWhereInput=status==='OVERDUE'?{status:'PENDING',dueDate:{lt:today}}:status==='TODAY'?{status:'PENDING',dueDate:{gte:today,lt:tomorrow}}:status==='PENDING'?{status:'PENDING',dueDate:{gte:today}}:{status};
 const tasks=await db.followUpTask.findMany({where:{AND:[{companyId:user.companyId,branchId:branches.branchId,assignedUserId:{in:userIds}},statusWhere]},include:{lead:{select:{id:true,title:true,companyName:true,contactName:true,customer:{select:{name:true}}}},assignedUser:{select:{id:true,name:true}},createdByUser:{select:{id:true,name:true}},completedVisit:{select:{id:true,checkedInAt:true,checkedOutAt:true,user:{select:{id:true,name:true}}}}},orderBy:[{dueDate:'asc'},{createdAt:'asc'},{id:'asc'}],take:300});
 return{status,employeeId:rawEmployeeId,employees,tasks:tasks.map(task=>({id:task.id,status:task.status,dueDate:task.dueDate,notes:task.notes,leadId:task.leadId,leadTitle:task.lead.title,subjectName:task.lead.customer?.name??task.lead.companyName??task.lead.contactName??task.lead.title,assignedUserId:task.assignedUserId,assignedUserName:task.assignedUser.name,createdByUserName:task.createdByUser.name,createdAt:task.createdAt,completedAt:task.completedAt,completedVisitId:task.completedVisitId,checkedInAt:task.completedVisit?.checkedInAt??null,checkedOutAt:task.completedVisit?.checkedOutAt??null,completedVisitUserName:task.completedVisit?.user.name??null,lastAction:task.status==='COMPLETED'?'Checkout completed':task.status==='CANCELLED'?'Cancelled':task.completedVisitId?'Follow-up check-in started':'No action yet',canStartCheckIn:mobileFieldWorkEnabled(user)&&task.assignedUserId===user.id&&task.status==='PENDING'&&!task.completedVisitId,canCancel:mobileCan(user,'SALES_FOLLOW_UPS')&&task.status==='PENDING'&&!task.completedVisitId}))};
}
