import type {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {indiaDateText,parseIndiaBusinessDate} from '@/lib/follow-up-tasks/date';
import {mobileCan,mobileFieldWorkEnabled,type MobilePrincipal} from './auth';

const allowedStatuses=['TODAY','OVERDUE','PENDING','COMPLETED','CANCELLED'] as const;
type MobileFollowUpStatus=(typeof allowedStatuses)[number];

export async function mobileFollowUps(user:MobilePrincipal,rawStatus:string|null){
 if(user.salesRole!=='SALES'||!mobileCan(user,'SALES_FOLLOW_UPS')||!mobileFieldWorkEnabled(user))throw new Error('FORBIDDEN');
 const branches=await operationalBranchContext(user),today=parseIndiaBusinessDate(indiaDateText()),tomorrow=new Date(today.getTime()+86_400_000);
 const status:MobileFollowUpStatus=allowedStatuses.includes(rawStatus as MobileFollowUpStatus)?rawStatus as MobileFollowUpStatus:'TODAY';
 const statusWhere:Prisma.FollowUpTaskWhereInput=status==='OVERDUE'?{status:'PENDING',dueDate:{lt:today}}:status==='TODAY'?{status:'PENDING',dueDate:{gte:today,lt:tomorrow}}:status==='PENDING'?{status:'PENDING',dueDate:{gte:today}}:{status};
 const tasks=await db.followUpTask.findMany({where:{AND:[{companyId:user.companyId,branchId:branches.branchId,assignedUserId:user.id},statusWhere]},include:{lead:{select:{id:true,title:true,companyName:true,contactName:true,customer:{select:{name:true}}}},completedVisit:{select:{id:true,checkedInAt:true,checkedOutAt:true}}},orderBy:[{dueDate:'asc'},{createdAt:'asc'},{id:'asc'}],take:300});
 return{status,tasks:tasks.map(task=>({id:task.id,status:task.status,dueDate:task.dueDate,notes:task.notes,leadId:task.leadId,leadTitle:task.lead.title,subjectName:task.lead.customer?.name??task.lead.companyName??task.lead.contactName??task.lead.title,completedVisitId:task.completedVisitId,checkedInAt:task.completedVisit?.checkedInAt??null,checkedOutAt:task.completedVisit?.checkedOutAt??null,canStartCheckIn:task.status==='PENDING'&&!task.completedVisitId}))};
}
