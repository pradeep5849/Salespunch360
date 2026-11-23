"use server";

import { revalidatePath } from "next/cache";
import { endAttendance, startAttendance, updateCompanyOperations, uploadLocationPoint } from "@/lib/attendance/service";

type LocationMeasurement = { latitude: number; longitude: number; accuracyMeters?: number; capturedAt: string };
export type AttendanceActionResult = { ok: boolean; error?: string; ignored?: boolean; confirmedAt?: string };

export async function startAttendanceAction(location?: LocationMeasurement, branchId?: string): Promise<AttendanceActionResult> {
  let confirmedAt: string;
  try { const row = await startAttendance({ location, branchId }); confirmedAt = row.startedAt.toISOString(); }
  catch (error) { const code=error instanceof Error?error.message:"";return { ok: false, error: code==="GPS_REQUIRED"?"A fresh location is required before attendance can start.":code==="OUTSIDE_RADIUS"?"You are outside the attendance geofence.":code==="INSUFFICIENT_ACCURACY"?"Location accuracy is insufficient for this geofence.":code==="GEOFENCE_CONFIGURATION"?"Attendance geofence configuration is incomplete.":"Unable to start attendance. Check company settings or your current session." }; }
  revalidatePath("/workspace/attendance");
  return { ok: true, confirmedAt };
}

export async function endAttendanceAction(location?: LocationMeasurement): Promise<AttendanceActionResult> {
  let confirmedAt: string;
  try { const row = await endAttendance({ location }); confirmedAt = row.endedAt!.toISOString(); }
  catch { return { ok: false, error: "Unable to end attendance. Refresh and try again." }; }
  revalidatePath("/workspace/attendance");
  return { ok: true, confirmedAt };
}

export async function uploadLocationPointAction(point: LocationMeasurement & { capturedAt: string }): Promise<AttendanceActionResult> {
  try { await uploadLocationPoint(point); }
  catch (error) {
    if (error instanceof Error && error.message === "THROTTLED") return { ok: true, ignored: true };
    return { ok: false, error: "Location update was not accepted." };
  }
  return { ok: true };
}

export async function updateOperationsAction(formData: FormData) {
  try {
    await updateCompanyOperations({ attendanceEnabled: formData.get("attendanceEnabled") === "on", gpsTrackingEnabled: formData.get("gpsTrackingEnabled") === "on", checkoutRequiredBeforeNextCheckIn: formData.get("checkoutRequiredBeforeNextCheckIn") === "on" });
  } catch { return {saveError:"OPERATIONS_SAVE_FAILED"}; }
  revalidatePath("/workspace/settings");
  revalidatePath("/workspace/attendance");
  return {saved:true};
}
