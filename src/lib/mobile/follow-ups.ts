import {z} from 'zod';
import {pageWindow,pageResult} from '@/lib/pagination';
import type {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {indiaDateText,parseIndiaBusinessDate} from '@/lib/follow-up-tasks/date';
import {decodeFollowUpNotes} from '@/lib/follow-up-tasks/type';
import {mobileCan,mobileFieldWorkEnabled,type MobilePrincipal} from './auth';
import {mobileReportActor} from './report-actor';
import {reportEmployeeOptions,resolveEmployeeScope} from '@/lib/reports/scope';

const allowedStatuses=['TODAY','OVERDUE','PENDING','COMPLETED','CANCELLED','ALL','AVAILABLE'] as const;
type MobileFollowUpStatus=(typeof allowedStatuses)[number];

export async function mobileFollowUps(user:MobilePrincipal,rawStatus:string|null,rawEmployeeId:string|null=null,raw:{leadId?:string;page?:string;pageSize?:string;q?:string}={}){
 const paging=pageWindow(raw),leadId=raw.leadId?z.string().uuid().parse(raw.leadId):undefined;
 if(user.salesRole==='SALES'? !mobileCan(user,'SALES_FOLLOW_UPS'):!mobileCan(user,'SALES_REPORTS'))throw new Error('FORBIDDEN');
 const branches=await operationalBranchContext(user),today=parseIndiaBusinessDate(indiaDateText()),tomorrow=new Date(today.getTime()+86_400_000);
 const actor=mobileReportActor(user),employees=user.salesRole==='SALES'?[]:await reportEmployeeOptions(actor),employeeId=user.salesRole==='SALES'?user.id:rawEmployeeId??undefined,userIds=await resolveEmployeeScope(actor,employeeId);
 const status:MobileFollowUpStatus=allowedStatuses.includes(rawStatus as MobileFollowUpStatus)?rawStatus as MobileFollowUpStatus:'TODAY';
 const statusWhere:Prisma.FollowUpTaskWhereInput=status==='ALL'?{}:status==='AVAILABLE'?{status:'PENDING',assignedUserId:user.id,completedVisitId:null,OR:[{notes:null},{NOT:{notes:{startsWith:'[[SP360_FOLLOW_UP:CALL]]'}}}]}:status==='OVERDUE'?{status:'PENDING',dueDate:{lt:today}}:status==='TODAY'?{status:'PENDING',dueDate:{gte:today,lt:tomorrow}}:status==='PENDING'?{status:'PENDING',dueDate:{gte:tomorrow}}:{status};
 const tasks=await db.followUpTask.findMany({where:{AND:[{companyId:user.companyId,branchId:branches.branchId,assignedUserId:{in:userIds},leadId,...(raw.q?{lead:{title:{contains:raw.q.slice(0,100),mode:"insensitive"}}}:{})},statusWhere]},include:{lead:{select:{id:true,title:true,companyName:true,contactName:true,customer:{select:{name:true}}}},assignedUser:{select:{id:true,name:true}},createdByUser:{select:{id:true,name:true}},completedVisit:{select:{id:true,checkedInAt:true,checkedOutAt:true,user:{select:{id:true,name:true}}}}},orderBy:[{dueDate:'asc'},{createdAt:'asc'},{id:'asc'}],skip:paging.skip,take:paging.take});
 const page=pageResult(tasks,raw);return{status,employeeId:rawEmployeeId,employees,page:page.page,hasMore:page.hasMore,tasks:page.items.map(task=>{const presentation=decodeFollowUpNotes(task.notes),isVisit=presentation.type==='VISIT',isCall=presentation.type==='CALL';return{id:task.id,type:presentation.type,status:task.status,dueDate:task.dueDate,notes:presentation.notes,leadId:task.leadId,leadTitle:task.lead.title,subjectName:task.lead.customer?.name??task.lead.companyName??task.lead.contactName??task.lead.title,assignedUserId:task.assignedUserId,assignedUserName:task.assignedUser.name,createdByUserName:task.createdByUser.name,createdAt:task.createdAt,completedAt:task.completedAt,completedVisitId:task.completedVisitId,checkedInAt:task.completedVisit?.checkedInAt??null,checkedOutAt:task.completedVisit?.checkedOutAt??null,completedVisitUserName:task.completedVisit?.user.name??null,lastAction:task.status==='COMPLETED'?(isCall?'Call completed':'Visit completed'):task.status==='CANCELLED'?(isCall?'Call cancelled':'Visit cancelled'):task.completedVisitId?'Visit check-in started':isCall?'Call pending':'Visit pending',canStartCheckIn:isVisit&&mobileFieldWorkEnabled(user)&&task.assignedUserId===user.id&&task.status==='PENDING'&&!task.completedVisitId,canCompleteCall:isCall&&task.assignedUserId===user.id&&task.status==='PENDING'&&!task.completedVisitId,canCancel:mobileCan(user,'SALES_FOLLOW_UPS')&&task.status==='PENDING'&&!task.completedVisitId};})};
}
