import { haversineDistanceMeters,type Coordinate } from "@/lib/location/geo";
export type GeofenceVerdict={allowed:true;distanceMeters:number}|{allowed:false;type:"OUTSIDE_RADIUS"|"INSUFFICIENT_ACCURACY";distanceMeters:number};
/** Accuracy worse than the radius cannot prove presence, even when the reported point is inside. */
export function evaluateGeofence(actual:Coordinate&{accuracyMeters?:number},reference:Coordinate,radius:number):GeofenceVerdict{
 const distanceMeters=haversineDistanceMeters(actual,reference);
 if(actual.accuracyMeters==null||actual.accuracyMeters>radius)return {allowed:false,type:"INSUFFICIENT_ACCURACY",distanceMeters};
 if(distanceMeters>radius)return {allowed:false,type:"OUTSIDE_RADIUS",distanceMeters};
 return {allowed:true,distanceMeters};
}
