import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";
import {reportActor,reportEmployeeOptions,resolveEmployeeScope,type ReportActor} from "./scope";
import {parseReportFilters,type SearchParams} from "./validation";

const indiaDate=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(d);
const dbDate=(text:string)=>new Date(`${text}T00:00:00.000Z`);

export async function expenseReport(raw:SearchParams,provided?:ReportActor){
 const actor=provided??await reportActor(),filters=parseReportFilters(raw),ids=await resolveEmployeeScope(actor,filters.employeeId),employees=await reportEmployeeOptions(actor);
 const [company,eligible,points]=await Promise.all([
  db.company.findUnique({where:{id:actor.companyId},select:{travelRatePerKm:true}}),
  db.user.findMany({where:{companyId:actor.companyId,id:{in:ids},travelAllowanceEnabled:true},select:{id:true,name:true,travelRatePerKm:true}}),
  db.locationPoint.findMany({
   where:{companyId:actor.companyId,userId:{in:ids},capturedAt:{gte:filters.start,lt:filters.endExclusive}},
   select:{id:true,userId:true,attendanceId:true,latitude:true,longitude:true,accuracyMeters:true,capturedAt:true,sequenceNumber:true},
   orderBy:[{userId:"asc"},{attendanceId:"asc"},{capturedAt:"asc"},{sequenceNumber:"asc"},{id:"asc"}],
   take:100001
  })
 ]);
 const eligibleMap=new Map(eligible.map(u=>[u.id,u]));
 const attendanceGroups=new Map<string,typeof points>();
 for(const p of points){
  if(!eligibleMap.has(p.userId))continue;
  const date=indiaDate(p.capturedAt),key=`${p.userId}:${date}:${p.attendanceId}`,list=attendanceGroups.get(key)||[];list.push(p);attendanceGroups.set(key,list);
 }
 const daily=new Map<string,{employeeId:string;employee:string;date:string;distanceMeters:number;rate:Prisma.Decimal|null}>();
 for(const [key,row] of attendanceGroups){
  const [employeeId,date]=key.split(":"),u=eligibleMap.get(employeeId)!;
  const dayKey=`${employeeId}:${date}`,existing=daily.get(dayKey);
  const distance=Math.round(calculateTravelDistanceMeters(row));
  if(existing)existing.distanceMeters+=distance;
  else daily.set(dayKey,{employeeId,employee:u.name,date,distanceMeters:distance,rate:u.travelRatePerKm??company?.travelRatePerKm??null});
 }
 // Every calculable employee/day gets a persistent PENDING record. Approved/Rejected snapshots never change automatically.
 const approvalWhere={companyId:actor.companyId,employeeId:{in:ids},businessDate:{gte:dbDate(filters.startText),lte:dbDate(filters.endText)}} as const;
 const before=await db.dailyTravelApproval.findMany({where:approvalWhere,select:{id:true,employeeId:true,businessDate:true,status:true}});
 const beforeMap=new Map(before.map(a=>[`${a.employeeId}:${a.businessDate.toISOString().slice(0,10)}`,a]));
 const mutations=[];
 for(const r of [...daily.values()].filter(x=>x.rate)){
  const amount=new Prisma.Decimal(r.distanceMeters).div(1000).mul(r.rate!).toDecimalPlaces(2),key=`${r.employeeId}:${r.date}`,existing=beforeMap.get(key);
  if(!existing)mutations.push(db.dailyTravelApproval.create({data:{companyId:actor.companyId,employeeId:r.employeeId,businessDate:dbDate(r.date),distanceMeters:r.distanceMeters,ratePerKm:r.rate!,amount,status:"PENDING"}}));
  else if(existing.status==="PENDING")mutations.push(db.dailyTravelApproval.update({where:{id:existing.id},data:{distanceMeters:r.distanceMeters,ratePerKm:r.rate!,amount}}));
 }
 if(mutations.length)await db.$transaction(mutations);
 const approvals=await db.dailyTravelApproval.findMany({where:approvalWhere,select:{employeeId:true,businessDate:true,distanceMeters:true,ratePerKm:true,amount:true,status:true,reviewedAt:true}});
 const approvalMap=new Map(approvals.map(a=>[`${a.employeeId}:${a.businessDate.toISOString().slice(0,10)}`,a]));
 const rows=[...daily.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.employee.localeCompare(b.employee)).map(r=>{
  const approval=approvalMap.get(`${r.employeeId}:${r.date}`);
  return{key:`${r.employeeId}:${r.date}`,...r,ratePerKm:approval?.ratePerKm??r.rate,amount:approval?.amount??(r.rate?new Prisma.Decimal(r.distanceMeters).div(1000).mul(r.rate).toDecimalPlaces(2):null),status:approval?.status??null,reviewedAt:approval?.reviewedAt??null};
 });
 return{actor,filters,employees,rows,pointLimitExceeded:points.length>100000,companyRate:company?.travelRatePerKm??null};
}
