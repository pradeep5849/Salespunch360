import { cleanedTravelRouteSegments, type TravelRoutePoint } from '@/lib/location/travel-route';

/** Draw exactly the same independent route segments used for reported distance. */
export function measuredGpsSegments<T extends TravelRoutePoint>(sessions: T[][]): T[][] {
  return sessions.flatMap(session => cleanedTravelRouteSegments(session));
}

export function latestRecordedGpsPoint<T extends {capturedAt:Date}>(points:T[]):T|undefined{
 return points.reduce<T|undefined>((latest,point)=>!latest||point.capturedAt>latest.capturedAt?point:latest,undefined);
}
