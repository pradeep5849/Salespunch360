import { operationalBranchContext } from "@/lib/branches/operational-scope";
import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";
import {reportActor,reportEmployeeOptions,resolveEmployeeScope,type ReportActor} from "./scope";
import {parseReportFilters,type SearchParams} from "./validation";

const indiaDate=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(d);
const dbDate=(text:string)=>new Date(`${text}T00:00:00.000Z`);
type ApprovalMode="MANUAL"|"AUTO";

export async function expenseReport(raw:SearchParams,provided?:ReportActor){
 const actor=provided??await reportActor(),filters=parseReportFilters(raw),ids=await resolveEmployeeScope(actor,filters.employeeId),employees=await reportEmployeeOptions(actor),branches=await operationalBranchContext(actor,typeof raw.branchId==="string"?raw.branchId:undefined);
 const [company,eligible,points,modes]=await Promise.all([
  db.company.findUnique({where:{id:actor.companyId},select:{travelRatePerKm:true}}),
  db.user.findMany({where:{companyId:actor.companyId,id:{in:ids},travelAllowanceEnabled:true},select:{id:true,name:true,travelRatePerKm:true}}),
  db.locationPoint.findMany({
   where:{companyId:actor.companyId,branchId:branches.branchId,userId:{in:ids},capturedAt:{gte:filters.start,lt:filters.endExclusive}},
   select:{id:true,branchId:true,userId:true,attendanceId:true,latitude:true,longitude:true,accuracyMeters:true,capturedAt:true,sequenceNumber:true},
   orderBy:[{userId:"asc"},{attendanceId:"asc"},{capturedAt:"asc"},{sequenceNumber:"asc"},{id:"asc"}],
   take:100001
  }),
  ids.length?db.$queryRaw<{id:string;mode:string}[]>(Prisma.sql`SELECT "id", "travelApprovalMode" AS mode FROM "users" WHERE "companyId"=${actor.companyId}::uuid AND "id" IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))})`):Promise.resolve([])
 ]);
 const eligibleMap=new Map(eligible.map(u=>[u.id,u])),modeMap=new Map(modes.map(row=>[row.id,(row.mode==="AUTO"?"AUTO":"MANUAL") as ApprovalMode]));
 const attendanceGroups=new Map<string,typeof points>();
 for(const p of points){
  if(!eligibleMap.has(p.userId))continue;
  const date=indiaDate(p.capturedAt),key=`${p.branchId}:${p.userId}:${date}:${p.attendanceId}`,list=attendanceGroups.get(key)||[];list.push(p);attendanceGroups.set(key,list);
 }
 const daily=new Map<string,{branchId:string;employeeId:string;employee:string;date:string;distanceMeters:number;rate:Prisma.Decimal|null;approvalMode:ApprovalMode}>();
 for(const [key,row] of attendanceGroups){
  const [branchId,employeeId,date]=key.split(":"),u=eligibleMap.get(employeeId)!;
  const dayKey=`${branchId}:${employeeId}:${date}`,existing=daily.get(dayKey);
  const distance=Math.round(calculateTravelDistanceMeters(row));
  if(existing)existing.distanceMeters+=distance;
  else daily.set(dayKey,{branchId,employeeId,employee:u.name,date,distanceMeters:distance,rate:u.travelRatePerKm??company?.travelRatePerKm??null,approvalMode:modeMap.get(employeeId)??"MANUAL"});
 }
 // Calculable days are snapshotted. Manual users stay pending; Auto users are approved automatically.
 // Approved/Rejected historical snapshots are never rewritten by a later rate or mode change.
 const approvalWhere={companyId:actor.companyId,branchId:branches.branchId,employeeId:{in:ids},businessDate:{gte:dbDate(filters.startText),lte:dbDate(filters.endText)}} as const;
 const before=await db.dailyTravelApproval.findMany({where:approvalWhere,select:{id:true,branchId:true,employeeId:true,businessDate:true,status:true}});
 const beforeMap=new Map(before.map(a=>[`${a.branchId}:${a.employeeId}:${a.businessDate.toISOString().slice(0,10)}`,a]));
 const mutations: Prisma.PrismaPromise<unknown>[]=[];
 for(const r of [...daily.values()].filter(x=>x.rate)){
  const amount=new Prisma.Decimal(r.distanceMeters).div(1000).mul(r.rate!).toDecimalPlaces(2),key=`${r.branchId}:${r.employeeId}:${r.date}`,existing=beforeMap.get(key),auto=r.approvalMode==="AUTO";
  if(!existing)mutations.push(db.dailyTravelApproval.create({data:{companyId:actor.companyId,branchId:r.branchId,employeeId:r.employeeId,businessDate:dbDate(r.date),distanceMeters:r.distanceMeters,ratePerKm:r.rate!,amount,status:auto?"APPROVED":"PENDING",reviewedAt:auto?new Date():null}}));
  else if(existing.status==="PENDING")mutations.push(db.dailyTravelApproval.update({where:{id:existing.id},data:{distanceMeters:r.distanceMeters,ratePerKm:r.rate!,amount,...(auto?{status:"APPROVED" as const,reviewedAt:new Date(),reviewedByUserId:null}:{})}}));
 }
 if(mutations.length)await db.$transaction(mutations);
 const approvals=await db.dailyTravelApproval.findMany({where:approvalWhere,select:{branchId:true,employeeId:true,businessDate:true,distanceMeters:true,ratePerKm:true,amount:true,status:true,reviewedAt:true}});
 const approvalMap=new Map(approvals.map(a=>[`${a.branchId}:${a.employeeId}:${a.businessDate.toISOString().slice(0,10)}`,a]));
 const rows=[...daily.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.employee.localeCompare(b.employee)).map(r=>{
  const approval=approvalMap.get(`${r.branchId}:${r.employeeId}:${r.date}`),amount=approval?.amount??(r.rate?new Prisma.Decimal(r.distanceMeters).div(1000).mul(r.rate).toDecimalPlaces(2):null),status=approval?.status??null;
  return{key:`${r.branchId}:${r.employeeId}:${r.date}`,...r,ratePerKm:approval?.ratePerKm??r.rate,amount,status,approvedAmount:status==="APPROVED"?amount:null,reviewedAt:approval?.reviewedAt??null};
 });
 return{actor,filters,employees,rows,pointLimitExceeded:points.length>100000,companyRate:company?.travelRatePerKm??null};
}
