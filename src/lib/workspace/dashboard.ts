import type {Role} from "@prisma/client";
import {AuthorizationError,requireRole} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import{indiaDateText,parseIndiaBusinessDate}from"@/lib/follow-up-tasks/date";

export type DashboardActor={id:string;name:string;email:string;role:Role;companyId:string};
export function dashboardEmployeeWhere(actor:DashboardActor){
 if(actor.role==="COMPANY_ADMIN")return{companyId:actor.companyId,role:{in:["MANAGER","SALES"] as ("MANAGER"|"SALES")[]},isActive:true};
 if(actor.role==="MANAGER")return{companyId:actor.companyId,role:"SALES" as const,managerId:actor.id,isActive:true};
 return{companyId:actor.companyId,id:actor.id,role:"SALES" as const,isActive:true};
}
export async function dashboardData(raw:{checkInEmployee?:string;liveEmployee?:string}){
 const user=await requireRole("COMPANY_ADMIN","MANAGER","SALES");if(!user.companyId)throw new AuthorizationError();const actor={...user,companyId:user.companyId};
 const employees=await db.user.findMany({where:dashboardEmployeeWhere(actor),select:{id:true,name:true,role:true},orderBy:{name:"asc"}});
 const allowed=new Set(employees.map(e=>e.id));
 const requestedCheck=raw.checkInEmployee,checkUserId=actor.role==="SALES"?actor.id:requestedCheck&&allowed.has(requestedCheck)?requestedCheck:undefined;
 const requestedLive=raw.liveEmployee,liveUserId=actor.role!=="SALES"&&requestedLive&&allowed.has(requestedLive)?requestedLive:undefined;
 const today=new Date();today.setUTCHours(0,0,0,0);
 const teamIds=actor.role==="SALES"?[actor.id]:actor.role==="MANAGER"?[actor.id,...employees.map(e=>e.id)]:employees.map(e=>e.id);
 const indiaToday=parseIndiaBusinessDate(indiaDateText()),indiaTomorrow=new Date(indiaToday.getTime()+86400000);
 const [company,openAttendance,visits,presentCount,todayVisitCount,todayLeadCount,latestLocation,pendingTodayTasks,overdueTasks]=await Promise.all([
  db.company.findUniqueOrThrow({where:{id:actor.companyId},select:{name:true,logoObjectKey:true,addressLine1:true,addressLine2:true,locality:true,city:true,state:true,postalCode:true,country:true,subscriptionStatus:true,trialEndsAt:true,attendanceEnabled:true,gpsTrackingEnabled:true}}),
  actor.role==="COMPANY_ADMIN"?null:db.attendance.findFirst({where:{companyId:actor.companyId,userId:actor.id,endedAt:null},include:{_count:{select:{locationPoints:true}}}}),
  db.customerVisit.findMany({where:{companyId:actor.companyId,userId:checkUserId?checkUserId:{in:teamIds},checkedOutAt:{not:null}},orderBy:[{checkedOutAt:"desc"},{id:"desc"}],take:8,select:{id:true,contactName:true,photo:{select:{id:true}},checkedInAt:true,checkedOutAt:true,checkInLatitude:true,checkInLongitude:true,checkoutSentiment:true,checkoutRemarks:true,visitNotes:true,user:{select:{name:true}},customer:{select:{name:true,address:true}}}}),
  db.attendance.count({where:{companyId:actor.companyId,userId:{in:teamIds},startedAt:{gte:today}}}),
  db.customerVisit.count({where:{companyId:actor.companyId,userId:{in:teamIds},checkedInAt:{gte:today}}}),
  db.lead.count({where:{companyId:actor.companyId,assignedUserId:{in:teamIds},createdAt:{gte:today}}}),
  liveUserId?db.locationPoint.findFirst({where:{companyId:actor.companyId,userId:liveUserId},orderBy:[{capturedAt:"desc"},{sequenceNumber:"desc"}],select:{latitude:true,longitude:true,capturedAt:true,user:{select:{name:true}}}}):null,
  actor.role==="COMPANY_ADMIN"?0:db.followUpTask.count({where:{companyId:actor.companyId,assignedUserId:actor.id,status:"PENDING",dueDate:{gte:indiaToday,lt:indiaTomorrow}}}),
  actor.role==="COMPANY_ADMIN"?0:db.followUpTask.count({where:{companyId:actor.companyId,assignedUserId:actor.id,status:"PENDING",dueDate:{lt:indiaToday}}})
 ]);
 return{actor,company,employees,checkUserId,liveUserId,openAttendance,visits,presentCount,todayVisitCount,todayLeadCount,latestLocation,pendingTodayTasks,overdueTasks};
}
