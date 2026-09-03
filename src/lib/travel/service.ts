import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {requireRole} from "@/lib/auth/authorization";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";

const businessDate=(text:string)=>new Date(`${text}T00:00:00.000Z`);

export async function companyTravelSettings(){
 const admin=await requireRole("COMPANY_ADMIN");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 return db.company.findUnique({where:{id:admin.companyId},select:{travelRatePerKm:true}});
}

export async function updateCompanyTravelRate(raw:unknown){
 const admin=await requireRole("COMPANY_ADMIN");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 const n=Number(raw);
 if(!Number.isFinite(n)||n<0||n>100000)throw new Error("INVALID_RATE");
 return db.company.update({where:{id:admin.companyId},data:{travelRatePerKm:new Prisma.Decimal(n.toFixed(2))}});
}

export async function updateEmployeeTravelSettings(employeeId:string,enabled:boolean,customRate:string|null){
 const admin=await requireRole("COMPANY_ADMIN");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 const companyId=admin.companyId;
 let rate:Prisma.Decimal|null=null;
 if(customRate&&customRate.trim()!==""){
  const n=Number(customRate);
  if(!Number.isFinite(n)||n<0||n>100000)throw new Error("INVALID_RATE");
  rate=new Prisma.Decimal(n.toFixed(2));
 }
 const changed=await db.user.updateMany({where:{id:employeeId,companyId,role:{in:["MANAGER","SALES"]}},data:{travelAllowanceEnabled:enabled,travelRatePerKm:rate}});
 if(changed.count!==1)throw new Error("NOT_FOUND");
}

async function calculateEmployeeDay(tx:Prisma.TransactionClient,companyId:string,employeeId:string,date:string){
 const start=businessDate(date),end=new Date(start.getTime()+86400000);
 // India business-date UTC boundaries: midnight IST = previous day 18:30 UTC.
 const indiaStart=new Date(start.getTime()-19800000),indiaEnd=new Date(end.getTime()-19800000);
 const points=await tx.locationPoint.findMany({where:{companyId,userId:employeeId,capturedAt:{gte:indiaStart,lt:indiaEnd}},select:{id:true,attendanceId:true,latitude:true,longitude:true,accuracyMeters:true,capturedAt:true,sequenceNumber:true},orderBy:[{attendanceId:"asc"},{capturedAt:"asc"},{sequenceNumber:"asc"},{id:"asc"}]});
 const byAttendance=new Map<string,typeof points>();
 for(const p of points){const a=byAttendance.get(p.attendanceId)||[];a.push(p);byAttendance.set(p.attendanceId,a)}
 return Math.round([...byAttendance.values()].reduce((sum,row)=>sum+calculateTravelDistanceMeters(row),0));
}

export async function reviewDailyTravel(employeeId:string,date:string,status:"APPROVED"|"REJECTED"){
 const admin=await requireRole("COMPANY_ADMIN");
 if(!admin.companyId)throw new Error("NOT_AUTHORIZED");
 const companyId=admin.companyId;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("INVALID_DATE");
 return db.$transaction(async tx=>{
  const employee=await tx.user.findFirst({where:{id:employeeId,companyId,role:{in:["MANAGER","SALES"]},travelAllowanceEnabled:true},select:{id:true,travelRatePerKm:true}});
  if(!employee)throw new Error("NOT_FOUND");
  const company=await tx.company.findUnique({where:{id:companyId},select:{travelRatePerKm:true}});
  const rate=employee.travelRatePerKm??company?.travelRatePerKm;
  if(!rate)throw new Error("RATE_NOT_CONFIGURED");
  // Calculation uses authoritative accepted GPS points; snapshot is stored with the decision.
  const distanceMeters=await calculateEmployeeDay(tx,companyId,employeeId,date);
  const amount=new Prisma.Decimal(distanceMeters).div(1000).mul(rate).toDecimalPlaces(2);
  return tx.dailyTravelApproval.upsert({
   where:{companyId_employeeId_businessDate:{companyId,employeeId,businessDate:businessDate(date)}},
   update:{distanceMeters,ratePerKm:rate,amount,status,reviewedByUserId:admin.id,reviewedAt:new Date()},
   create:{companyId,employeeId,businessDate:businessDate(date),distanceMeters,ratePerKm:rate,amount,status,reviewedByUserId:admin.id,reviewedAt:new Date()}
  });
 });
}
