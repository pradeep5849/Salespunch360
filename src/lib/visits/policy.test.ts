import { describe,expect,it } from "vitest";
import { assertPendingVisitAllowed, canManagerViewVisit, customerReferenceDistanceMeters, repeatVisitSummary, resolveAttendanceId } from "./policy";
describe("visit workflow policy",()=>{
 it("requires attendance only when enabled",()=>{expect(()=>resolveAttendanceId(true,null)).toThrow("ATTENDANCE_REQUIRED");expect(resolveAttendanceId(false,null)).toBeNull();expect(resolveAttendanceId(true,{id:"attendance"})).toBe("attendance")});
 it("blocks pending visits unconditionally",()=>{expect(()=>assertPendingVisitAllowed(true,1)).toThrow("CHECKOUT_REQUIRED");expect(()=>assertPendingVisitAllowed(false,2)).toThrow("CHECKOUT_REQUIRED");expect(()=>assertPendingVisitAllowed(false,0)).not.toThrow()});
 it("derives first and repeat visits",()=>{expect(repeatVisitSummary(0)).toEqual({previousVisitCount:0,isFirstVisit:true,isRepeatVisit:false});expect(repeatVisitSummary(3)).toEqual({previousVisitCount:3,isFirstVisit:false,isRepeatVisit:true})});
 it("restricts Manager visibility to self and assigned Sales",()=>{expect(canManagerViewVisit("m1",{id:"m1",role:"MANAGER",managerId:null})).toBe(true);expect(canManagerViewVisit("m1",{id:"s1",role:"SALES",managerId:"m1"})).toBe(true);expect(canManagerViewVisit("m1",{id:"s2",role:"SALES",managerId:"m2"})).toBe(false)});
 it("calculates customer-reference distance without geofence enforcement",()=>{const d=customerReferenceDistanceMeters({latitude:0,longitude:0},{latitude:0,longitude:.001});expect(d).toBeGreaterThan(110);expect(customerReferenceDistanceMeters({latitude:null,longitude:null},{latitude:0,longitude:0})).toBeNull()});
});
