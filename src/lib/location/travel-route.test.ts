import {describe,expect,it} from "vitest";
import {calculateTravelDistanceMeters} from "./travel-route";

type P={id:string;sequenceNumber:number;latitude:number;longitude:number;accuracyMeters:number|null;capturedAt:Date};
const point=(id:string,seconds:number,latitude:number,longitude:number,accuracyMeters:number|null=5,sequenceNumber=seconds):P=>({id,sequenceNumber,latitude,longitude,accuracyMeters,capturedAt:new Date(Date.UTC(2026,0,1,0,0,seconds))});

describe("cleaned attendance travel distance",()=>{
 it("does not accumulate stationary GPS jitter",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72,15),point("b",15,19.00005,72.00004,15),point("c",30,18.99996,71.99996,15)])).toBe(0));
 it("counts normal realistic movement",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72),point("b",60,19.005,72),point("c",120,19.01,72)])).toBeGreaterThan(1000));
 it("gives duplicate and near-duplicate points zero distance",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72),point("b",15,19,72),point("c",30,19.00001,72)])).toBe(0));
 it("rejects a teleport spike and its return",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72),point("spike",15,20,73),point("return",30,19,72),point("b",90,19.005,72)])).toBeLessThan(600));
 it("excludes poor-accuracy points",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72),point("bad",60,20,73,500),point("b",120,19.005,72)])).toBeLessThan(600));
 it("excludes impossible-speed segments",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72),point("b",10,19.1,72)])).toBe(0));
 it("sorts out-of-order input deterministically",()=>{const points=[point("c",120,19.01,72),point("a",0,19,72),point("b",60,19.005,72)];expect(calculateTravelDistanceMeters(points)).toBeCloseTo(calculateTravelDistanceMeters([...points].reverse()),6)});
 it("does not connect locations across a long GPS gap",()=>expect(calculateTravelDistanceMeters([point("a",0,19,72),point("b",3600,19.2,72)])).toBe(0));
 it("keeps a realistic roughly 30 km route near its expected distance",()=>{const route=Array.from({length:31},(_,i)=>point(String(i),i*120,19+i*0.009,72,8,i));const distance=calculateTravelDistanceMeters(route);expect(distance).toBeGreaterThan(29_000);expect(distance).toBeLessThan(31_000)});
});
