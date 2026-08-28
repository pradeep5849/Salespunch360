"use server";

import { revalidatePath } from "next/cache";
import { endAttendance, startAttendance, updateCompanyOperations, uploadLocationPoint } from "@/lib/attendance/service";

type LocationMeasurement = { latitude: number; longitude: number; accuracyMeters?: number };
export type AttendanceActionResult = { ok: boolean; error?: string; ignored?: boolean };

export async function startAttendanceAction(location?: LocationMeasurement): Promise<AttendanceActionResult> {
  try { await startAttendance({ location }); }
  catch { return { ok: false, error: "Unable to start attendance. Check company settings or your current session." }; }
  revalidatePath("/workspace/attendance");
  return { ok: true };
}

export async function endAttendanceAction(location?: LocationMeasurement): Promise<AttendanceActionResult> {
  try { await endAttendance({ location }); }
  catch { return { ok: false, error: "Unable to end attendance. Refresh and try again." }; }
  revalidatePath("/workspace/attendance");
  return { ok: true };
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
  } catch { return; }
  revalidatePath("/workspace/settings");
  revalidatePath("/workspace/attendance");
}
