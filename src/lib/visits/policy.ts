import { haversineDistanceMeters } from "@/lib/location/geo";

export class VisitPolicyError extends Error {
  constructor(public readonly code: "CUSTOMER_NOT_FOUND" | "ATTENDANCE_REQUIRED" | "CHECKOUT_REQUIRED" | "VISIT_NOT_FOUND" | "CUSTOMER_LOCATION_REQUIRED" | "OUTSIDE_RADIUS" | "INSUFFICIENT_ACCURACY"|"REPEAT_VISIT_OUTSIDE_RADIUS"|"PHOTO_REQUIRED"|"PHONE_REQUIRED"|"SUBJECT_OWNERSHIP_CONFLICT"|"PHOTO_INVALID"|"PHOTO_STORAGE_NOT_CONFIGURED"|"PHOTO_STORAGE_UNAVAILABLE",public readonly distanceMeters?:number) { super(code); }
}

export function resolveAttendanceId(attendanceEnabled: boolean, openAttendance: { id: string } | null) {
  if (attendanceEnabled && !openAttendance) throw new VisitPolicyError("ATTENDANCE_REQUIRED");
  return openAttendance?.id ?? null;
}

export function assertPendingVisitAllowed(required: boolean, pendingCount: number) {
  void required;if (pendingCount > 0) throw new VisitPolicyError("CHECKOUT_REQUIRED");
}

export function customerReferenceDistanceMeters(customer: { latitude: number | null; longitude: number | null }, actual: { latitude: number; longitude: number }) {
  if (customer.latitude === null || customer.longitude === null) return null;
  return haversineDistanceMeters({ latitude: customer.latitude, longitude: customer.longitude }, actual);
}

export function repeatVisitSummary(previousVisitCount: number) {
  return { previousVisitCount, isFirstVisit: previousVisitCount === 0, isRepeatVisit: previousVisitCount > 0 };
}

export function canManagerViewVisit(managerId: string, visitUser: { id: string; salesRole: string | null; managerId: string | null }) {
  return visitUser.id === managerId || (visitUser.salesRole === "SALES" && visitUser.managerId === managerId);
}
