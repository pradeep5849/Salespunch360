"use server";

import { revalidatePath } from "next/cache";
import { addPhoneToVisit, checkIn, checkout, fieldCheckIn } from "@/lib/visits/service";

type GPS = { latitude: number; longitude: number; accuracyMeters: number };
export type VisitActionResult = { ok: boolean; error?: string };
export async function fieldCheckInAction(form:FormData):Promise<VisitActionResult>{try{const location={latitude:Number(form.get("latitude")),longitude:Number(form.get("longitude")),accuracyMeters:Number(form.get("accuracyMeters"))},visitType=String(form.get("visitType")),common={visitType,location,visitNotes:String(form.get("visitNotes")||"")},input=visitType==="NEW"?{...common,name:String(form.get("name")),phone:String(form.get("phone")||"")}:visitType==="FOLLOW_UP"?{...common,leadId:String(form.get("leadId"))}:{...common,customerId:String(form.get("customerId"))};const photo=form.get("photo");await fieldCheckIn(input,photo instanceof File&&photo.size?photo:undefined);}catch(error){const code=error instanceof Error?error.message:"",distance=typeof error==="object"&&error&&"distanceMeters"in error?Math.round(Number(error.distanceMeters)):undefined;return{ok:false,error:code==="ATTENDANCE_REQUIRED"?"Start attendance before check-in.":code==="CHECKOUT_REQUIRED"?"Complete your current checkout before starting another check-in.":code==="PHOTO_REQUIRED"?"A photo is required for this check-in.":code==="PHOTO_INVALID"?"Unable to process this photo. Please take the photo again.":code==="PHOTO_STORAGE_NOT_CONFIGURED"?"Photo storage is not configured yet. Please contact your administrator.":code==="PHOTO_STORAGE_UNAVAILABLE"?"Photo storage is temporarily unavailable. Please try again later.":code==="REPEAT_VISIT_OUTSIDE_RADIUS"?`You are outside the allowed 50 m check-in radius. Current distance: ${distance} m.`:code==="SUBJECT_OWNERSHIP_CONFLICT"?"This phone or subject requires assignment resolution.":"Unable to add check-in. Verify the selection, GPS, and photo."};}revalidatePath("/workspace");revalidatePath("/workspace/check-ins");revalidatePath("/workspace/leads");return{ok:true};}
export async function addPhoneToVisitAction(form:FormData):Promise<VisitActionResult>{try{await addPhoneToVisit({visitId:form.get("visitId"),phone:form.get("phone")});revalidatePath("/workspace/check-ins");revalidatePath("/workspace/leads");return{ok:true};}catch{return{ok:false,error:"Unable to add this phone. It may already belong to another prospect."};}}

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
