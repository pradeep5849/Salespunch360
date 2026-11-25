import {describe,it,expect} from "vitest";
import {attendanceLocationPolicy,canMarkPersonalAttendance} from "./role-policy";
const settings={gpsTrackingEnabled:true,attendanceGeofenceEnabled:true};
describe("office attendance policy",()=>{
 it.each([{salesRole:"MANAGER",managerType:"MANAGER_ONLY"},{salesRole:"SALES",designation:"Telecaller"}] as const)("allows office attendance without field tracking",user=>{
 expect(canMarkPersonalAttendance(user)).toBe(true);
 expect(attendanceLocationPolicy(user,settings)).toEqual({gpsTrackingEnabled:false,attendanceGeofenceEnabled:true});
 });
 it.each([{salesRole:"MANAGER",managerType:"FIELD_MANAGER"},{salesRole:"SALES"}] as const)("keeps field staff free of office geofence",user=>{
 expect(canMarkPersonalAttendance(user)).toBe(true);
 expect(attendanceLocationPolicy(user,settings)).toEqual({gpsTrackingEnabled:true,attendanceGeofenceEnabled:false});
 });
 it.each(["PRIMARY_ADMIN","ADMIN"] as const)("excludes %s",salesRole=>expect(canMarkPersonalAttendance({salesRole})).toBe(false));
});
