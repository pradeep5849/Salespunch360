import type {ManagerType,SalesRole} from "@prisma/client";
import {isTelecallerDesignation} from "@/lib/telecalling/policy";
type AttendanceActor={salesRole:SalesRole|null;managerType?:ManagerType|null;designation?:string|null};
export function isOfficeAttendanceStaff(user:AttendanceActor){
 return (user.salesRole==="MANAGER"&&user.managerType==="MANAGER_ONLY")||(user.salesRole==="SALES"&&isTelecallerDesignation(user.designation));
}
export function canMarkPersonalAttendance(user:AttendanceActor){
 return user.salesRole==="SALES"||(user.salesRole==="MANAGER"&&(user.managerType==="MANAGER_ONLY"||user.managerType==="FIELD_MANAGER"));
}
export function attendanceLocationPolicy(user:AttendanceActor,settings:{gpsTrackingEnabled:boolean;attendanceGeofenceEnabled:boolean}){
 const office=isOfficeAttendanceStaff(user);
 return {gpsTrackingEnabled:!office&&settings.gpsTrackingEnabled,attendanceGeofenceEnabled:office&&settings.attendanceGeofenceEnabled};
}
