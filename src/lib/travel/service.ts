import {resolveOperationalWriteBranch} from "@/lib/branches/operational-scope";
import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError,requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";

const businessDate=(text:string)=>new Date(`${text}T00:00:00.000Z`);

export async function companyTravelSettings(){
 const admin=await requirePermission("SALES_SETTINGS");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 return db.company.findUnique({where:{id:admin.companyId},select:{travelRatePerKm:true}});
}

export async function updateCompanyTravelRate(raw:unknown){
 const admin=await requirePermissionForMutation("SALES_SETTINGS");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 const n=Number(raw);
 if(!Number.isFinite(n)||n<0||n>100000)throw new Error("INVALID_RATE");
 return db.company.update({where:{id:admin.companyId},data:{travelRatePerKm:new Prisma.Decimal(n.toFixed(2))}});
}

export async function updateEmployeeTravelSettings(employeeId:string,enabled:boolean,customRate:string|null){
 const admin=await requirePermissionForMutation("SALES_TRAVEL");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 if(admin.salesRole!=="PRIMARY_ADMIN")throw new AuthorizationError();
 const companyId=admin.companyId;
 let rate:Prisma.Decimal|null=null;
 if(customRate&&customRate.trim()!==""){
  const n=Number(customRate);
  if(!Number.isFinite(n)||n<0||n>100000)throw new Error("INVALID_RATE");
  rate=new Prisma.Decimal(n.toFixed(2));
 }
 const changed=await db.user.updateMany({where:{id:employeeId,companyId,isActive:true,salesAccessActive:true,salesRole:{in:["MANAGER","SALES"]}},data:{travelAllowanceEnabled:enabled,travelRatePerKm:rate}});
 if(changed.count!==1)throw new Error("NOT_FOUND");
}

async function calculateEmployeeDay(tx:Prisma.TransactionClient,companyId:string,branchId:string,employeeId:string,date:string){
 const start=businessDate(date),end=new Date(start.getTime()+86400000);
 // India business-date UTC boundaries: midnight IST = previous day 18:30 UTC.
 const indiaStart=new Date(start.getTime()-19800000),indiaEnd=new Date(end.getTime()-19800000);
 const points=await tx.locationPoint.findMany({where:{companyId,branchId,userId:employeeId,capturedAt:{gte:indiaStart,lt:indiaEnd}},select:{id:true,attendanceId:true,latitude:true,longitude:true,accuracyMeters:true,capturedAt:true,sequenceNumber:true},orderBy:[{attendanceId:"asc"},{capturedAt:"asc"},{sequenceNumber:"asc"},{id:"asc"}]});
 const byAttendance=new Map<string,typeof points>();
 for(const p of points){const a=byAttendance.get(p.attendanceId)||[];a.push(p);byAttendance.set(p.attendanceId,a)}
 return Math.round([...byAttendance.values()].reduce((sum,row)=>sum+calculateTravelDistanceMeters(row),0));
}

export async function reviewDailyTravel(employeeId:string,date:string,status:"APPROVED"|"REJECTED",requestedBranchId?:string){
 const admin=await requirePermissionForMutation("SALES_TRAVEL");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 if(admin.salesRole!=="PRIMARY_ADMIN")throw new AuthorizationError();
 const companyId=admin.companyId;const branchId=await resolveOperationalWriteBranch({id:admin.id,companyId},requestedBranchId);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("INVALID_DATE");
 return db.$transaction(async tx=>{
  const employee=await tx.user.findFirst({where:{id:employeeId,companyId,salesRole:{in:["MANAGER","SALES"]},travelAllowanceEnabled:true},select:{id:true,travelRatePerKm:true}});
  if(!employee)throw new Error("NOT_FOUND");
  await resolveOperationalWriteBranch({id:employee.id,companyId},branchId,tx);
  const company=await tx.company.findUnique({where:{id:companyId},select:{travelRatePerKm:true}});
  const rate=employee.travelRatePerKm??company?.travelRatePerKm;
  if(!rate)throw new Error("RATE_NOT_CONFIGURED");
  // Calculation uses authoritative accepted GPS points; snapshot is stored with the decision.
  const distanceMeters=await calculateEmployeeDay(tx,companyId,branchId,employeeId,date);
  const amount=new Prisma.Decimal(distanceMeters).div(1000).mul(rate).toDecimalPlaces(2);
  return tx.dailyTravelApproval.upsert({
   where:{companyId_branchId_employeeId_businessDate:{companyId,branchId,employeeId,businessDate:businessDate(date)}},
   update:{distanceMeters,ratePerKm:rate,amount,status,reviewedByUserId:admin.id,reviewedAt:new Date()},
   create:{companyId,branchId,employeeId,businessDate:businessDate(date),distanceMeters,ratePerKm:rate,amount,status,reviewedByUserId:admin.id,reviewedAt:new Date()}
  });
 });
}
