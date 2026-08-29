"use server";
import {revalidatePath} from "next/cache";
import {mutationGuard} from '@/lib/security/request';
import {updateGeofenceSettings} from "@/lib/geofence/service";
export async function updateGeofenceAction(formData:FormData){await mutationGuard('geofence-settings',20);await updateGeofenceSettings({attendanceGeofenceEnabled:formData.get("attendanceGeofenceEnabled")==="on",attendanceReferenceLatitude:formData.get("attendanceReferenceLatitude"),attendanceReferenceLongitude:formData.get("attendanceReferenceLongitude"),attendanceGeofenceRadiusMeters:formData.get("attendanceGeofenceRadiusMeters"),customerCheckInGeofenceEnabled:formData.get("customerCheckInGeofenceEnabled")==="on",customerCheckInGeofenceRadiusMeters:formData.get("customerCheckInGeofenceRadiusMeters")});revalidatePath("/workspace/settings")}
