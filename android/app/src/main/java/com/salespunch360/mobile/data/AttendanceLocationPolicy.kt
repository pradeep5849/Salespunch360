package com.salespunch360.mobile.data

/** Only a start needs a policy-required measurement; ending attendance must remain possible. */
internal fun attendanceNeedsLocation(features:Features,start:Boolean):Boolean =
 start && (features.gpsTrackingEnabled || features.attendanceGeofenceEnabled)

internal suspend fun attendanceMeasurement(features:Features,start:Boolean,measure:suspend ()->LocationPayload):LocationPayload? {
 if(attendanceNeedsLocation(features,start))return measure()
 if(start || !features.gpsTrackingEnabled)return null
 // An optional end point must not keep attendance active after GPS/permission failure.
 return try{measure()}catch(cancel:kotlinx.coroutines.CancellationException){throw cancel}catch(_:Exception){null}
}
