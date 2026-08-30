import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { calculateRouteDistanceMeters } from "@/lib/location/geo";
import { orderedRoute } from "./metrics";
import { parseReportFilters, type SearchParams } from "./validation";
import { reportActor, reportEmployeeOptions, resolveEmployeeScope, type ReportActor } from "./scope";

export async function gpsReport(raw:SearchParams,providedActor?:ReportActor){
 const actor=providedActor??await reportActor(),filters=parseReportFilters(raw),ids=await resolveEmployeeScope(actor,filters.employeeId),attendanceId=typeof raw.attendanceId==="string"?raw.attendanceId:undefined;
 const sessions=await db.attendance.findMany({where:{companyId:actor.companyId,userId:{in:ids},startedAt:{gte:filters.start,lt:filters.endExclusive}},select:{id:true,startedAt:true,endedAt:true,user:{select:{name:true}}},orderBy:[{startedAt:"desc"},{id:"desc"}],take:100});
 let selected=null;if(attendanceId){selected=await db.attendance.findFirst({where:{id:attendanceId,companyId:actor.companyId,userId:{in:ids},startedAt:{gte:filters.start,lt:filters.endExclusive}},include:{user:{select:{name:true,role:true}},locationPoints:{where:{companyId:actor.companyId,userId:{in:ids}}},customerVisits:{where:{companyId:actor.companyId,userId:{in:ids}},include:{customer:{select:{name:true}}}}}});if(!selected)throw new AuthorizationError();}
 const points=selected?orderedRoute(selected.locationPoints):[];const overlays=selected?selected.customerVisits.filter(v=>v.checkedInAt>=selected!.startedAt&&(!selected!.endedAt||v.checkedInAt<=selected!.endedAt)):[];
 return {actor,filters,employees:await reportEmployeeOptions(actor),sessions,selected,points,overlays,routeDistanceMeters:calculateRouteDistanceMeters(points)};
}
