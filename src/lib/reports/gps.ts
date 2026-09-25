import { operationalBranchContext } from "@/lib/branches/operational-scope";
import {AuthorizationError} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {calculateTravelDistanceMeters} from "@/lib/location/travel-route";
import {orderedRoute} from "./metrics";
import {indiaDateBoundary,reportUuid,type SearchParams} from "./validation";
import {reportActor,reportEmployeeOptions,resolveEmployeeScope,type ReportActor} from "./scope";

const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export type GpsTimelineEvent={
 id:string;
 type:"ATTENDANCE_STARTED"|"GPS_STARTED"|"VISIT"|"GPS_ENDED"|"ATTENDANCE_ENDED";
 at:Date;
 customer?:string;
 latitude?:number;
 longitude?:number;
 detail?:string;
 sessionId:string;
};

export async function gpsReport(raw:SearchParams,providedActor?:ReportActor){
 const actor=providedActor??await reportActor();
 const employees=await reportEmployeeOptions(actor);
 const date=one(raw.date);
 const requested=reportUuid(raw,"employeeId");
 const employeeId=actor.salesRole==="SALES"?actor.id:requested;
 const branches=await operationalBranchContext(actor,reportUuid(raw,"branchId"));
 const company=await db.company.findUnique({
  where:{id:actor.companyId},
  select:{
   attendanceGeofenceEnabled:true,
   attendanceReferenceLatitude:true,
   attendanceReferenceLongitude:true,
   attendanceGeofenceRadiusMeters:true,
  },
 });
 const geofence=company?.attendanceGeofenceEnabled&&company.attendanceReferenceLatitude!=null&&company.attendanceReferenceLongitude!=null&&company.attendanceGeofenceRadiusMeters!=null
  ?{latitude:company.attendanceReferenceLatitude,longitude:company.attendanceReferenceLongitude,radiusMeters:company.attendanceGeofenceRadiusMeters}
  :null;
 if(!date||!employeeId)return{
  actor,employees,date,employeeId,segments:[],points:[],markers:[],events:[],routeDistanceMeters:0,
  employee:null,lastSpottedAt:null,visitCount:0,geofence,
 };
 const ids=await resolveEmployeeScope(actor,employeeId);
 if(ids.length!==1)throw new AuthorizationError();
 const start=indiaDateBoundary(date),end=indiaDateBoundary(date,true);
 const employee=await db.user.findFirst({where:{id:employeeId,companyId:actor.companyId},select:{id:true,name:true,salesRole:true}});
 if(!employee)throw new AuthorizationError();

 // Attendance remains the authority for GPS collection. Each attendance period is a separate
 // route segment so movement while attendance is OFF is never measured or drawn.
 const sessions=await db.attendance.findMany({
  where:{companyId:actor.companyId,branchId:branches.branchId,userId:employeeId,startedAt:{lt:end},OR:[{endedAt:null},{endedAt:{gte:start}}]},
  include:{
   locationPoints:{
    where:{companyId:actor.companyId,branchId:branches.branchId,userId:employeeId,capturedAt:{gte:start,lt:end}},
    orderBy:[{sequenceNumber:"asc"},{capturedAt:"asc"},{id:"asc"}],
   },
   customerVisits:{
    where:{companyId:actor.companyId,branchId:branches.branchId,userId:employeeId,OR:[{checkedInAt:{gte:start,lt:end}},{checkedOutAt:{gte:start,lt:end}}]},
    include:{customer:{select:{name:true}}},
    orderBy:{checkedInAt:"asc"},
   },
  },
  orderBy:[{startedAt:"asc"},{id:"asc"}],
 });

 const segments=sessions.map(s=>orderedRoute(s.locationPoints));
 const points=segments.flat();
 let routeDistanceMeters=0;
 for(const segment of segments)routeDistanceMeters+=calculateTravelDistanceMeters(segment);
 const events:GpsTimelineEvent[]=[];
 const markers:Array<{latitude:number;longitude:number;label:string}>=[];
 const seenVisits=new Set<string>();

 for(const s of sessions){
  if(s.startedAt>=start&&s.startedAt<end){
   events.push({id:`${s.id}:start`,type:"ATTENDANCE_STARTED",at:s.startedAt,sessionId:s.id,latitude:s.startLatitude??undefined,longitude:s.startLongitude??undefined});
   if(s.startLatitude!=null&&s.startLongitude!=null)markers.push({latitude:s.startLatitude,longitude:s.startLongitude,label:"Attendance Started"});
  }
  const route=orderedRoute(s.locationPoints);
  if(route.length){
   events.push({
    id:`${s.id}:gps-start`,type:"GPS_STARTED",at:route[0].capturedAt,sessionId:s.id,
    latitude:route[0].latitude,longitude:route[0].longitude,
    detail:`GPS active · ${route.length} accepted point${route.length===1?"":"s"}`,
   });
   events.push({
    id:`${s.id}:gps-end`,type:"GPS_ENDED",at:route.at(-1)!.capturedAt,sessionId:s.id,
    latitude:route.at(-1)!.latitude,longitude:route.at(-1)!.longitude,
    detail:"GPS stopped with attendance",
   });
  }

  for(const v of s.customerVisits){
   if(seenVisits.has(v.id))continue;
   seenVisits.add(v.id);
   const useCheckout=Boolean(v.checkedOutAt&&v.checkedOutAt>=start&&v.checkedOutAt<end);
   const at=useCheckout?v.checkedOutAt!:v.checkedInAt;
   if(at<start||at>=end)continue;
   const customer=v.customer?.name||v.contactName||"Field prospect";
   const latitude=useCheckout?(v.checkOutLatitude??v.checkInLatitude):v.checkInLatitude;
   const longitude=useCheckout?(v.checkOutLongitude??v.checkInLongitude):v.checkInLongitude;
   const detail=useCheckout
    ?["Completed visit",v.checkoutSentiment,v.checkoutRemarks].filter(Boolean).join(" · ")
    :["Visit check-in",v.checkInAddress||v.visitNotes].filter(Boolean).join(" · ");
   events.push({id:`${v.id}:visit`,type:"VISIT",at,sessionId:s.id,customer,detail:detail||undefined,latitude,longitude});
   markers.push({latitude,longitude,label:`Visit: ${customer}`});
  }

  if(s.endedAt&&s.endedAt>=start&&s.endedAt<end){
   events.push({id:`${s.id}:end`,type:"ATTENDANCE_ENDED",at:s.endedAt,sessionId:s.id,latitude:s.endLatitude??undefined,longitude:s.endLongitude??undefined});
   if(s.endLatitude!=null&&s.endLongitude!=null)markers.push({latitude:s.endLatitude,longitude:s.endLongitude,label:"Attendance Ended"});
  }
 }

 events.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.id.localeCompare(b.id));
 const lastSpottedAt=points.length?points.at(-1)!.capturedAt:null;
 return{
  actor,employees,date,employeeId,segments,points,markers,events,routeDistanceMeters,employee,
  lastSpottedAt,visitCount:seenVisits.size,geofence,
  filters:{startText:date,endText:date},
 };
}
