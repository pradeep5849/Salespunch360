"use server";

import { revalidatePath } from "next/cache";
import { addPhoneToVisit, checkIn, checkout, fieldCheckIn } from "@/lib/visits/service";
import {fieldCheckInErrorMessage,logFieldCheckInFailure} from "@/lib/visits/field-checkin-errors";

type GPS = { latitude: number; longitude: number; accuracyMeters: number };
export type VisitActionResult = { ok: boolean; error?: string };
export async function fieldCheckInAction(form:FormData):Promise<VisitActionResult>{const visitType=String(form.get("visitType"));try{const location={latitude:Number(form.get("latitude")),longitude:Number(form.get("longitude")),accuracyMeters:Number(form.get("accuracyMeters"))},common={visitType,location,visitNotes:String(form.get("visitNotes")||"")},input=visitType==="NEW"?{...common,name:String(form.get("name")),phone:String(form.get("phone")||"")}:visitType==="FOLLOW_UP"?{...common,leadId:String(form.get("leadId")),...(form.get("followUpTaskId")?{followUpTaskId:String(form.get("followUpTaskId"))}:{})}:{...common,customerId:String(form.get("customerId"))};const photo=form.get("photo");await fieldCheckIn(input,photo instanceof File&&photo.size?photo:undefined);}catch(error){logFieldCheckInFailure(error,visitType);return{ok:false,error:fieldCheckInErrorMessage(error)};}revalidatePath("/workspace");revalidatePath("/workspace/check-ins");revalidatePath("/workspace/leads");revalidatePath("/workspace/follow-up-tasks");return{ok:true};}
export async function addPhoneToVisitAction(form:FormData):Promise<VisitActionResult>{try{await addPhoneToVisit({visitId:form.get("visitId"),phone:form.get("phone")});revalidatePath("/workspace/check-ins");revalidatePath("/workspace/leads");return{ok:true};}catch{return{ok:false,error:"Unable to add this phone. It may already belong to another prospect."};}}

export async function checkInAction(input: { customerId: string; visitNotes?: string; location: GPS }): Promise<VisitActionResult> {
  try { await checkIn(input); }
  catch (error) {
    const code=error instanceof Error?error.message:"";const message = code === "ATTENDANCE_REQUIRED" ? "Start attendance before customer check-in." : code === "CHECKOUT_REQUIRED" ? "Checkout the current visit before starting another." : code==="CUSTOMER_LOCATION_REQUIRED"?"This customer needs a reference location before geofenced check-in.":code==="OUTSIDE_RADIUS"?"You are outside the customer check-in geofence.":code==="INSUFFICIENT_ACCURACY"?"Location accuracy is insufficient for this customer geofence.":"Unable to check in. Confirm the customer and location.";
    return { ok: false, error: message };
  }
  revalidatePath("/workspace/check-ins"); revalidatePath("/workspace"); revalidatePath("/workspace/leads"); revalidatePath("/workspace/follow-up-tasks"); return { ok: true };
}

export async function checkoutAction(input: { visitId: string; sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"; remarks?: string; location: GPS }): Promise<VisitActionResult> {
  try { await checkout(input); }
  catch { return { ok: false, error: "Unable to checkout. Confirm the visit and current location." }; }
  revalidatePath("/workspace/check-ins"); revalidatePath("/workspace"); revalidatePath("/workspace/leads"); revalidatePath("/workspace/follow-up-tasks"); return { ok: true };
}
