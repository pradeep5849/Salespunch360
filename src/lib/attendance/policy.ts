import { LOCATION_CONFIG } from "@/lib/location/config";

export class AttendancePolicyError extends Error {
  constructor(public readonly code: "DISABLED" | "NO_OPEN_ATTENDANCE" | "ALREADY_OPEN" | "GPS_DISABLED" | "CAPTURE_TIME_INVALID" | "THROTTLED") {
    super(code);
  }
}

export function assertAttendanceOwnership(authenticated: { id: string; companyId: string }, attendance: { userId: string; companyId: string } | null) {
  if (!attendance || attendance.userId !== authenticated.id || attendance.companyId !== authenticated.companyId) {
    throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
  }
}

export function assertCaptureTime(capturedAt: Date, now = new Date()) {
  const delta = now.getTime() - capturedAt.getTime();
  if (delta > LOCATION_CONFIG.maximumCaptureAgeMs || delta < -LOCATION_CONFIG.maximumFutureSkewMs) {
    throw new AttendancePolicyError("CAPTURE_TIME_INVALID");
  }
}

export function shouldAcceptLocationPoint(
  previous: { latitude: number; longitude: number; capturedAt: Date } | null,
  next: { latitude: number; longitude: number; capturedAt: Date },
  distanceMeters: number,
) {
  if (!previous) return true;
  const elapsed = next.capturedAt.getTime() - previous.capturedAt.getTime();
  if (elapsed < 0) return false;
  return elapsed >= LOCATION_CONFIG.minimumAcceptedIntervalMs || distanceMeters >= LOCATION_CONFIG.minimumMovementMeters;
}
