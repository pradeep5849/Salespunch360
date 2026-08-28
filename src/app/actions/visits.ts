"use server";

import { revalidatePath } from "next/cache";
import { checkIn, checkout } from "@/lib/visits/service";

type GPS = { latitude: number; longitude: number; accuracyMeters: number };
export type VisitActionResult = { ok: boolean; error?: string };

export async function checkInAction(input: { customerId: string; visitNotes?: string; location: GPS }): Promise<VisitActionResult> {
  try { await checkIn(input); }
  catch (error) {
    const message = error instanceof Error && error.message === "ATTENDANCE_REQUIRED" ? "Start attendance before customer check-in." : error instanceof Error && error.message === "CHECKOUT_REQUIRED" ? "Checkout the current visit before starting another." : "Unable to check in. Confirm the customer and location.";
    return { ok: false, error: message };
  }
  revalidatePath("/workspace/check-ins"); return { ok: true };
}

export async function checkoutAction(input: { visitId: string; sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"; remarks?: string; location: GPS }): Promise<VisitActionResult> {
  try { await checkout(input); }
  catch { return { ok: false, error: "Unable to checkout. Confirm the visit and current location." }; }
  revalidatePath("/workspace/check-ins"); return { ok: true };
}
