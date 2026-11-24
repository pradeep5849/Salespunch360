import { Prisma } from "@prisma/client";
import { calculateTravelDistanceMeters } from "@/lib/location/travel-route";
const dateText=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(date);
export async function refreshStoppedTravelDay(tx:Prisma.TransactionClient,companyId:string,branchId:string,employeeId:string,date:string,reconcileSettings=false){
  // All stop, late-point and review writers serialize on the same employee.
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${employeeId}::uuid AND "companyId"=${companyId}::uuid FOR UPDATE`;
  const employee=await tx.user.findFirst({where:{id:employeeId,companyId},select:{travelAllowanceEnabled:true,travelApprovalMode:true,travelRatePerKm:true}});
  if(!employee?.travelAllowanceEnabled)return;
  const key={companyId,branchId,employeeId,businessDate:new Date(`${date}T00:00:00Z`)};
  const existing=await tx.dailyTravelApproval.findUnique({where:{companyId_branchId_employeeId_businessDate:key}});
  if((reconcileSettings && existing && existing.status!=="PENDING") || existing?.reviewedByUserId || (employee.travelApprovalMode!=="AUTO" && existing && existing.status!=="PENDING"))return;
  const company=await tx.company.findUnique({where:{id:companyId},select:{travelRatePerKm:true}});
  const rate=(reconcileSettings?null:existing?.ratePerKm)??employee.travelRatePerKm??company?.travelRatePerKm;
  if(rate==null)return;
  const start=new Date(`${date}T00:00:00+05:30`),end=new Date(start.getTime()+86400000);
  const points=await tx.locationPoint.findMany({where:{companyId,branchId,userId:employeeId,capturedAt:{gte:start,lt:end},attendance:{endedAt:{not:null}}},select:{id:true,attendanceId:true,latitude:true,longitude:true,accuracyMeters:true,capturedAt:true,sequenceNumber:true},orderBy:[{attendanceId:"asc"},{capturedAt:"asc"},{sequenceNumber:"asc"},{id:"asc"}]});
  const sessions=new Map<string,typeof points>();
  for(const point of points){const rows=sessions.get(point.attendanceId)??[];rows.push(point);sessions.set(point.attendanceId,rows)}
  const distanceMeters=Math.round([...sessions.values()].reduce((sum,rows)=>sum+calculateTravelDistanceMeters(rows),0));
  const automatic=employee.travelApprovalMode==="AUTO";
  const values={distanceMeters,ratePerKm:rate,amount:new Prisma.Decimal(distanceMeters).div(1000).mul(rate).toDecimalPlaces(2),status:automatic?"APPROVED" as const:"PENDING" as const,reviewedAt:automatic?new Date():null,reviewedByUserId:null};
  return tx.dailyTravelApproval.upsert({where:{companyId_branchId_employeeId_businessDate:key},create:{...key,...values},update:values});
}
export async function refreshStoppedAttendanceTravel(tx:Prisma.TransactionClient,companyId:string,branchId:string,employeeId:string,startedAt:Date,endedAt:Date){
  const last=dateText(endedAt);
  for(let date=dateText(startedAt);date<=last;date=new Date(new Date(`${date}T00:00:00Z`).getTime()+86400000).toISOString().slice(0,10))await refreshStoppedTravelDay(tx,companyId,branchId,employeeId,date);
}
export const travelBusinessDate=dateText;

// Reconcile historical completed GPS days without changing finalized decisions.
export async function reconcileEmployeeTravelHistory(tx:Prisma.TransactionClient,companyId:string,employeeId:string){
 const employee=await tx.user.findFirst({where:{id:employeeId,companyId},select:{travelAllowanceEnabled:true}});
 if(!employee?.travelAllowanceEnabled)return;
 const days=await tx.$queryRaw<Array<{branchId:string;day:string}>>`SELECT DISTINCT p."branchId", to_char(p."capturedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS day FROM "location_points" p JOIN "attendances" a ON a.id=p."attendanceId" WHERE p."companyId"=${companyId}::uuid AND p."userId"=${employeeId}::uuid AND a."endedAt" IS NOT NULL ORDER BY day, p."branchId"`;
 for(const day of days)await refreshStoppedTravelDay(tx,companyId,day.branchId,employeeId,day.day,true);
}
