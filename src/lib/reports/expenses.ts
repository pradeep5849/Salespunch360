import {operationalBranchContext} from "@/lib/branches/operational-scope";
import {Prisma} from "@prisma/client";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";
import {db} from "@/lib/db";
import {reportActor,reportEmployeeOptions,resolveEmployeeScope,type ReportActor} from "./scope";
import {parseReportFilters,type SearchParams} from "./validation";
export async function expenseReport(raw:SearchParams,provided?:ReportActor){
 const actor=provided??await reportActor(),filters=parseReportFilters(raw),ids=await resolveEmployeeScope(actor,filters.employeeId),employees=await reportEmployeeOptions(actor),branches=await operationalBranchContext(actor,typeof raw.branchId==="string"?raw.branchId:undefined);
 const [company,approvals]=await Promise.all([
  db.company.findUnique({where:{id:actor.companyId},select:{travelRatePerKm:true}}),
  db.dailyTravelApproval.findMany({where:{companyId:actor.companyId,branchId:branches.branchId,employeeId:{in:ids},businessDate:{gte:new Date(`${filters.startText}T00:00:00Z`),lte:new Date(`${filters.endText}T00:00:00Z`)}},include:{employee:{select:{name:true}}},orderBy:[{businessDate:"desc"},{employeeId:"asc"},{branchId:"asc"}]})
 ]);
 const rows=approvals.map(approval=>{const date=approval.businessDate.toISOString().slice(0,10);return{key:`${approval.branchId}:${approval.employeeId}:${date}`,branchId:approval.branchId,employeeId:approval.employeeId,employee:approval.employee.name,date,distanceMeters:approval.distanceMeters,rate:approval.ratePerKm,ratePerKm:approval.ratePerKm,amount:approval.amount,status:approval.status,approvalMode:approval.status==="APPROVED"&&!approval.reviewedByUserId?"AUTO":"MANUAL",approvedAmount:approval.status==="APPROVED"?approval.amount:null,reviewedAt:approval.reviewedAt}});
 const points=await db.locationPoint.findMany({where:{companyId:actor.companyId,branchId:branches.branchId,userId:{in:ids},capturedAt:{gte:filters.start,lt:filters.endExclusive},attendance:{endedAt:{not:null}}},select:{id:true,branchId:true,userId:true,attendanceId:true,latitude:true,longitude:true,accuracyMeters:true,capturedAt:true,sequenceNumber:true,user:{select:{name:true}}},orderBy:[{attendanceId:"asc"},{capturedAt:"asc"},{sequenceNumber:"asc"},{id:"asc"}]});
 const saved=new Set(rows.map(row=>row.key));
 const groups=new Map<string,typeof points>();
 for(const point of points){
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(point.capturedAt);
  const key= `${point.branchId}:${point.userId}:${date}`;
  if(saved.has(key))continue;
  const group=groups.get(key)??[];group.push(point);groups.set(key,group);
 }
 for(const [key,group] of groups){
  const first=group[0],date=key.split(":")[2],sessions=new Map<string,typeof points>();
  for(const point of group){const session=sessions.get(point.attendanceId)??[];session.push(point);sessions.set(point.attendanceId,session)}
  const distanceMeters=Math.round([...sessions.values()].reduce((sum,session)=>sum+calculateTravelDistanceMeters(session),0));
  rows.push({key,branchId:first.branchId,employeeId:first.userId,employee:first.user.name,date,distanceMeters,rate:new Prisma.Decimal(0),ratePerKm:new Prisma.Decimal(0),amount:new Prisma.Decimal(0),status:null as unknown as typeof rows[number]["status"],approvalMode:"MANUAL",approvedAmount:null,reviewedAt:null});
 }
 rows.sort((a,b)=>b.date.localeCompare(a.date)||a.employeeId.localeCompare(b.employeeId));
 return{actor,filters,employees,rows,pointLimitExceeded:false,companyRate:company?.travelRatePerKm??null};
}
