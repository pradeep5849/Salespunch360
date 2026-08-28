import type { LeadStage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { calculateRouteDistanceMeters, haversineDistanceMeters, type Coordinate } from "@/lib/location/geo";

export const durationMs = (start:Date,end:Date|null) => end ? Math.max(0,end.getTime()-start.getTime()) : null;
export function visitKind(current:{id:string;checkedInAt:Date}, prior:{id:string;checkedInAt:Date}[]) {
  return prior.some(v=>v.checkedInAt < current.checkedInAt || (v.checkedInAt.getTime()===current.checkedInAt.getTime() && v.id < current.id)) ? "REPEAT VISIT" : "FIRST VISIT";
}
export function referenceDistance(checkIn:Coordinate, customer:{latitude:number|null;longitude:number|null}) {
  return customer.latitude == null || customer.longitude == null ? null : haversineDistanceMeters(checkIn,{latitude:customer.latitude,longitude:customer.longitude});
}
export function orderedRoute<T extends Coordinate & {sequenceNumber:number;capturedAt:Date;id:string}>(points:T[]) {
  return [...points].sort((a,b)=>a.sequenceNumber-b.sequenceNumber || a.capturedAt.getTime()-b.capturedAt.getTime() || a.id.localeCompare(b.id));
}
export const routeDistance = (points:Coordinate[]) => calculateRouteDistanceMeters(points);
export function leadValues(leads:{stage:LeadStage;estimatedValue:Prisma.Decimal|null}[]) {
  const active:LeadStage[]=["NEW","QUALIFIED","PROPOSAL","NEGOTIATION"];
  return leads.reduce((a,l)=>({pipeline:active.includes(l.stage)?a.pipeline.plus(l.estimatedValue||0):a.pipeline,won:l.stage==="WON"?a.won.plus(l.estimatedValue||0):a.won}),{pipeline:new Prisma.Decimal(0),won:new Prisma.Decimal(0)});
}
