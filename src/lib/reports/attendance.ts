import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateTravelDistanceMeters } from "@/lib/location/travel-route";
import { durationMs, orderedRoute } from "./metrics";
import { parseReportFilters, type SearchParams } from "./validation";
import { reportActor, reportEmployeeOptions, resolveEmployeeScope, type ReportActor } from "./scope";

export async function attendanceReport(raw:SearchParams,providedActor?:ReportActor,exportMode=false){
 const actor=providedActor??await reportActor(),filters=parseReportFilters(raw,undefined,exportMode?10000:undefined),userIds=await resolveEmployeeScope(actor,filters.employeeId);const status=raw.status==="COMPLETED"||raw.status==="OPEN"?raw.status:"ALL";
 const where:Prisma.AttendanceWhereInput={companyId:actor.companyId,userId:{in:userIds},startedAt:{gte:filters.start,lt:filters.endExclusive},...(status==="COMPLETED"?{endedAt:{not:null}}:status==="OPEN"?{endedAt:null}:{})};
 const [total,completed,open,aggregates,records,employees]=await Promise.all([db.attendance.count({where}),db.attendance.count({where:{...where,endedAt:{not:null}}}),db.attendance.count({where:{...where,endedAt:null}}),db.attendance.findMany({where:{...where,endedAt:{not:null}},select:{startedAt:true,endedAt:true},take:10001}),db.attendance.findMany({where,include:{user:{select:{name:true,role:true}},locationPoints:{select:{id:true,latitude:true,longitude:true,accuracyMeters:true,sequenceNumber:true,capturedAt:true},orderBy:[{sequenceNumber:"asc"},{capturedAt:"asc"},{id:"asc"}]}},orderBy:[{startedAt:"desc"},{id:"desc"}],skip:(filters.page-1)*filters.pageSize,take:filters.pageSize}),reportEmployeeOptions(actor)]);
 if(aggregates.length>10000)throw new Error(exportMode?"ROW_LIMIT":"Report summary exceeds the interactive record limit; narrow the filters.");
 const rows=records.map(a=>{const route=orderedRoute(a.locationPoints);return {...a,durationMs:durationMs(a.startedAt,a.endedAt),routeDistanceMeters:calculateTravelDistanceMeters(route)}});const totalDurationMs=aggregates.reduce((n,a)=>n+(durationMs(a.startedAt,a.endedAt)||0),0);
 return {actor,filters,status,employees,rows,totalPages:Math.max(1,Math.ceil(total/filters.pageSize)),summary:{total,completed,open,totalDurationMs,averageDurationMs:completed?totalDurationMs/completed:0}};
}
