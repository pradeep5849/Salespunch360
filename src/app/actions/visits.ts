"use server";

import { revalidatePath } from "next/cache";
import { checkIn, checkout } from "@/lib/visits/service";

type GPS = { latitude: number; longitude: number; accuracyMeters: number };
export type VisitActionResult = { ok: boolean; error?: string };

export async function checkInAction(input: { customerId: string; visitNotes?: string; location: GPS }): Promise<VisitActionResult> {
  try { await checkIn(input); }
  catch (error) {
    const code=error instanceof Error?error.message:"";const message = code === "ATTENDANCE_REQUIRED" ? "Start attendance before customer check-in." : code === "CHECKOUT_REQUIRED" ? "Checkout the current visit before starting another." : code==="CUSTOMER_LOCATION_REQUIRED"?"This customer needs a reference location before geofenced check-in.":code==="OUTSIDE_RADIUS"?"You are outside the customer check-in geofence.":code==="INSUFFICIENT_ACCURACY"?"Location accuracy is insufficient for this customer geofence.":"Unable to check in. Confirm the customer and location.";
    return { ok: false, error: message };
  }
  revalidatePath("/workspace/check-ins"); return { ok: true };
}

export async function checkoutAction(input: { visitId: string; sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"; remarks?: string; location: GPS }): Promise<VisitActionResult> {
  try { await checkout(input); }
  catch { return { ok: false, error: "Unable to checkout. Confirm the visit and current location." }; }
  revalidatePath("/workspace/check-ins"); return { ok: true };
}
