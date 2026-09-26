import { operationalBranchContext } from "@/lib/branches/operational-scope";
import type {ManagerType,Role,SalesRole} from "@prisma/client";
import {requireSalesWorkspace} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import{indiaDateText,parseIndiaBusinessDate}from"@/lib/follow-up-tasks/date";
import {isTelecallerDesignation} from "@/lib/telecalling/policy";

export type DashboardActor={id:string;name:string;email:string;role:Role;salesRole:SalesRole;managerType:ManagerType|null;companyId:string};
const isAdmin=(actor:DashboardActor)=>actor.salesRole==="PRIMARY_ADMIN"||actor.salesRole==="ADMIN";
const isManager=(actor:DashboardActor)=>actor.salesRole==="MANAGER";
const isSales=(actor:DashboardActor)=>actor.salesRole==="SALES";
export function dashboardEmployeeWhere(actor:DashboardActor){
 if(isAdmin(actor))return{companyId:actor.companyId,salesRole:{in:["MANAGER","SALES"] as ("MANAGER"|"SALES")[]},salesAccessActive:true,isActive:true};
 if(isManager(actor))return{companyId:actor.companyId,salesRole:"SALES" as const,salesAccessActive:true,managerId:actor.id,isActive:true};
 return{companyId:actor.companyId,id:actor.id,salesRole:"SALES" as const,salesAccessActive:true,isActive:true};
}
export async function dashboardData(raw:{checkInEmployee?:string;liveEmployee?:string}){
 const user=await requireSalesWorkspace();if(!user.salesRole)throw new Error("SALES_ROLE_REQUIRED");const actor={...user,salesRole:user.salesRole,companyId:user.companyId};const branches=await operationalBranchContext(actor);
 const employees=await db.user.findMany({where:dashboardEmployeeWhere(actor),select:{id:true,name:true,role:true,salesRole:true,managerType:true,designation:true},orderBy:{name:"asc"}});
 const checkInEmployees=employees.filter(employee=>(employee.salesRole==="SALES"&&!isTelecallerDesignation(employee.designation))||(employee.salesRole==="MANAGER"&&employee.managerType!=="MANAGER_ONLY"));
 const liveEmployees=employees.filter(employee=>employee.salesRole==="SALES");
 const allowedLive=new Set(liveEmployees.map(e=>e.id)),allowedCheck=new Set(checkInEmployees.map(e=>e.id));
 const requestedCheck=raw.checkInEmployee,checkUserId=isSales(actor)?actor.id:requestedCheck&&allowedCheck.has(requestedCheck)?requestedCheck:undefined;
 const requestedLive=raw.liveEmployee,liveUserId=!isSales(actor)&&requestedLive&&allowedLive.has(requestedLive)?requestedLive:undefined;
 const indiaTodayText=indiaDateText(),indiaToday=parseIndiaBusinessDate(indiaTodayText),indiaTomorrow=new Date(indiaToday.getTime()+86400000);
 const [indiaYear,indiaMonth]=indiaTodayText.split("-");const indiaMonthStart=parseIndiaBusinessDate(`${indiaYear}-${indiaMonth}-01`);
 const fieldManager=isManager(actor)&&actor.managerType!=="MANAGER_ONLY";
 const employeeIds=employees.map(e=>e.id),checkEmployeeIds=checkInEmployees.map(e=>e.id);
 const teamIds=isSales(actor)?[actor.id]:isManager(actor)?(fieldManager?[actor.id,...checkEmployeeIds]:checkEmployeeIds):checkEmployeeIds;
 const presentIds=isSales(actor)?[actor.id]:employeeIds;
 const [company,openAttendance,visits,presentCount,todayVisitCount,todayLeadCount,monthVisitCount,monthLeadCount,latestLocation,pendingTodayTasks,overdueTasks]=await Promise.all([
  db.company.findUniqueOrThrow({where:{id:actor.companyId},select:{name:true,logoObjectKey:true,updatedAt:true,addressLine1:true,addressLine2:true,locality:true,city:true,state:true,postalCode:true,country:true,subscriptionStatus:true,trialEndsAt:true,attendanceEnabled:true,gpsTrackingEnabled:true}}),
  (isAdmin(actor)||(isManager(actor)&&!fieldManager))?null:db.attendance.findFirst({where:{companyId:actor.companyId,branchId:branches.branchId,userId:actor.id,endedAt:null},include:{_count:{select:{locationPoints:true}}}}),
  db.customerVisit.findMany({where:{companyId:actor.companyId,branchId:branches.branchId,userId:checkUserId?checkUserId:{in:teamIds},checkedOutAt:{not:null}},orderBy:[{checkedOutAt:"desc"},{id:"desc"}],take:5,select:{id:true,contactName:true,photo:{select:{id:true}},checkedInAt:true,checkedOutAt:true,checkInLatitude:true,checkInLongitude:true,checkInAddress:true,checkoutSentiment:true,checkoutRemarks:true,visitNotes:true,user:{select:{name:true}},customer:{select:{name:true}}}}),
  db.user.count({where:{companyId:actor.companyId,id:{in:presentIds},isActive:true,attendances:{some:{companyId:actor.companyId,branchId:branches.branchId,startedAt:{gte:indiaToday,lt:indiaTomorrow}}}}}),
  db.customerVisit.count({where:{companyId:actor.companyId,branchId:branches.branchId,userId:{in:teamIds},checkedInAt:{gte:indiaToday,lt:indiaTomorrow}}}),
  db.lead.count({where:{companyId:actor.companyId,branchId:branches.branchId,assignedUserId:{in:teamIds},createdAt:{gte:indiaToday,lt:indiaTomorrow}}}),
  db.customerVisit.count({where:{companyId:actor.companyId,branchId:branches.branchId,userId:{in:teamIds},checkedInAt:{gte:indiaMonthStart,lt:indiaTomorrow}}}),
  db.lead.count({where:{companyId:actor.companyId,branchId:branches.branchId,assignedUserId:{in:teamIds},createdAt:{gte:indiaMonthStart,lt:indiaTomorrow}}}),
  liveUserId?db.locationPoint.findFirst({where:{companyId:actor.companyId,branchId:branches.branchId,userId:liveUserId},orderBy:[{capturedAt:"desc"},{sequenceNumber:"desc"}],select:{latitude:true,longitude:true,capturedAt:true,user:{select:{name:true}}}}):null,
  (isAdmin(actor)||(isManager(actor)&&!fieldManager))?0:db.followUpTask.count({where:{companyId:actor.companyId,branchId:branches.branchId,assignedUserId:actor.id,status:"PENDING",dueDate:{gte:indiaToday,lt:indiaTomorrow}}}),
  (isAdmin(actor)||(isManager(actor)&&!fieldManager))?0:db.followUpTask.count({where:{companyId:actor.companyId,branchId:branches.branchId,assignedUserId:actor.id,status:"PENDING",dueDate:{lt:indiaToday}}})
 ]);
 return{actor,company,employees,checkInEmployees,liveEmployees,checkUserId,liveUserId,openAttendance,visits,presentCount,todayVisitCount,todayLeadCount,monthVisitCount,monthLeadCount,latestLocation,pendingTodayTasks,overdueTasks};
}
