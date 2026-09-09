import { operationalBranchContext } from "@/lib/branches/operational-scope";
import {AuthorizationError} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";
import {orderedRoute} from "./metrics";
import {indiaDateBoundary,type SearchParams} from "./validation";
import {reportActor,reportEmployeeOptions,resolveEmployeeScope,type ReportActor} from "./scope";

const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export type GpsTimelineEvent={id:string;type:"ATTENDANCE_STARTED"|"GPS_STARTED"|"CHECK_IN"|"CHECK_OUT"|"GPS_ENDED"|"ATTENDANCE_ENDED";at:Date;customer?:string;latitude?:number;longitude?:number;detail?:string;sessionId:string};
export async function gpsReport(raw:SearchParams,providedActor?:ReportActor){
 const actor=providedActor??await reportActor(),employees=await reportEmployeeOptions(actor),date=one(raw.date),requested=one(raw.employeeId),employeeId=actor.salesRole==="SALES"?actor.id:requested,branches=await operationalBranchContext(actor,typeof raw.branchId==="string"?raw.branchId:undefined);
 if(!date||!employeeId)return{actor,employees,date,employeeId,sessions:[],segments:[],points:[],markers:[],events:[],routeDistanceMeters:0,employee:null};
 const ids=await resolveEmployeeScope(actor,employeeId);if(ids.length!==1)throw new AuthorizationError();const start=indiaDateBoundary(date),end=indiaDateBoundary(date,true);
 const employee=await db.user.findFirst({where:{id:employeeId,companyId:actor.companyId},select:{id:true,name:true,salesRole:true}});if(!employee)throw new AuthorizationError();
 const sessions=await db.attendance.findMany({where:{companyId:actor.companyId,branchId:branches.branchId,userId:employeeId,startedAt:{lt:end},OR:[{endedAt:null},{endedAt:{gte:start}}]},include:{locationPoints:{where:{companyId:actor.companyId,branchId:branches.branchId,userId:employeeId,capturedAt:{gte:start,lt:end}},orderBy:[{sequenceNumber:"asc"},{capturedAt:"asc"},{id:"asc"}]},customerVisits:{where:{companyId:actor.companyId,branchId:branches.branchId,userId:employeeId,OR:[{checkedInAt:{gte:start,lt:end}},{checkedOutAt:{gte:start,lt:end}}]},include:{customer:{select:{name:true}}},orderBy:{checkedInAt:"asc"}}},orderBy:[{startedAt:"asc"},{id:"asc"}]});
 const segments=sessions.map(s=>orderedRoute(s.locationPoints));const points=segments.flat();let routeDistanceMeters=0;for(const segment of segments)routeDistanceMeters+=calculateTravelDistanceMeters(segment);
 const events:GpsTimelineEvent[]=[];const markers:Array<{latitude:number;longitude:number;label:string}>=[];
 for(const s of sessions){
  if(s.startedAt>=start&&s.startedAt<end){events.push({id:`${s.id}:start`,type:"ATTENDANCE_STARTED",at:s.startedAt,sessionId:s.id,latitude:s.startLatitude??undefined,longitude:s.startLongitude??undefined});if(s.startLatitude!=null&&s.startLongitude!=null)markers.push({latitude:s.startLatitude,longitude:s.startLongitude,label:"Attendance Started"})}
  const route=orderedRoute(s.locationPoints);if(route.length){events.push({id:`${s.id}:gps-start`,type:"GPS_STARTED",at:route[0].capturedAt,sessionId:s.id,latitude:route[0].latitude,longitude:route[0].longitude,detail:`${route.length} accepted point${route.length===1?"":"s"}`});events.push({id:`${s.id}:gps-end`,type:"GPS_ENDED",at:route.at(-1)!.capturedAt,sessionId:s.id,latitude:route.at(-1)!.latitude,longitude:route.at(-1)!.longitude})}
  for(const v of s.customerVisits){if(v.checkedInAt>=start&&v.checkedInAt<end){events.push({id:`${v.id}:in`,type:"CHECK_IN",at:v.checkedInAt,sessionId:s.id,customer:v.customer?.name||v.contactName||"Field prospect",detail:v.checkInAddress||v.visitNotes||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`,latitude:v.checkInLatitude,longitude:v.checkInLongitude});markers.push({latitude:v.checkInLatitude,longitude:v.checkInLongitude,label:`Check-in: ${v.customer?.name||v.contactName||"Field prospect"}${v.checkInAddress?` · ${v.checkInAddress}`:""}`})}if(v.checkedOutAt&&v.checkedOutAt>=start&&v.checkedOutAt<end){events.push({id:`${v.id}:out`,type:"CHECK_OUT",at:v.checkedOutAt,sessionId:s.id,customer:v.customer?.name||v.contactName||"Field prospect",detail:v.checkoutSentiment||v.checkoutRemarks||undefined,latitude:v.checkOutLatitude??undefined,longitude:v.checkOutLongitude??undefined});if(v.checkOutLatitude!=null&&v.checkOutLongitude!=null)markers.push({latitude:v.checkOutLatitude,longitude:v.checkOutLongitude,label:`Check-out: ${v.customer?.name||v.contactName||"Field prospect"}`})}}
  if(s.endedAt&&s.endedAt>=start&&s.endedAt<end){events.push({id:`${s.id}:end`,type:"ATTENDANCE_ENDED",at:s.endedAt,sessionId:s.id,latitude:s.endLatitude??undefined,longitude:s.endLongitude??undefined});if(s.endLatitude!=null&&s.endLongitude!=null)markers.push({latitude:s.endLatitude,longitude:s.endLongitude,label:"Attendance Ended"})}
 }
 events.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.id.localeCompare(b.id));return{actor,employees,date,employeeId,sessions,segments,points,markers,events,routeDistanceMeters,employee};
}
