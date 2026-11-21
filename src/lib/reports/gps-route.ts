import {cleanedTravelRoute,TRAVEL_ROUTE_CONFIG,type TravelRoutePoint} from '@/lib/location/travel-route';
/** Draw exactly the quality-filtered route used for distance, without bridging long gaps. */
export function measuredGpsSegments<T extends TravelRoutePoint>(sessions:T[][]){
 const segments:T[][]=[];
 for(const session of sessions){
  let segment:T[]=[];
  for(const point of cleanedTravelRoute(session)){
   const last=segment.at(-1);
   if(last&&point.capturedAt.getTime()-last.capturedAt.getTime()>TRAVEL_ROUTE_CONFIG.maximumGapMs){segments.push(segment);segment=[];}
   segment.push(point);
  }
  if(segment.length)segments.push(segment);
 }
 return segments;
}
export function latestRecordedGpsPoint<T extends {capturedAt:Date}>(points:T[]):T|undefined{
 return points.reduce<T|undefined>((latest,point)=>!latest||point.capturedAt>latest.capturedAt?point:latest,undefined);
}
