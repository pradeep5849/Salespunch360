package com.salespunch360.mobile.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.salespunch360.mobile.data.LocationPayload
import java.time.Instant
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

private const val MAX_LOCATION_AGE_NANOS=120_000_000_000L
private const val MAX_LOCATION_FUTURE_SKEW_NANOS=30_000_000_000L
private const val CURRENT_LOCATION_TIMEOUT_MS=6_000L
class LocationUnavailable:Exception()
class LocationDisabled:Exception()
class LocationTimedOut:Exception()
class StaleLocation:Exception()

internal fun isLocationMeasurementFresh(measuredElapsedNanos:Long,nowElapsedNanos:Long):Boolean {
 val age=nowElapsedNanos-measuredElapsedNanos
 return measuredElapsedNanos>0L&&age<=MAX_LOCATION_AGE_NANOS&&age>=-MAX_LOCATION_FUTURE_SKEW_NANOS
}

internal fun locationPayload(latitude:Double,longitude:Double,accuracyMeters:Double,measurementTimeMillis:Long):LocationPayload {
 if(measurementTimeMillis<=0L)throw StaleLocation()
 return LocationPayload(latitude,longitude,accuracyMeters,capturedAt=Instant.ofEpochMilli(measurementTimeMillis).toString())
}

internal fun locationPayload(location:Location,nowElapsedNanos:Long=SystemClock.elapsedRealtimeNanos()):LocationPayload {
 if(!isLocationMeasurementFresh(location.elapsedRealtimeNanos,nowElapsedNanos))throw StaleLocation()
 return locationPayload(location.latitude,location.longitude,location.accuracy.toDouble(),location.time)
}

private fun requireLocationReady(context:Context){
 if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)throw SecurityException()
 val manager=context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
 if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)&&!manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))throw LocationDisabled()
}

suspend fun recentDeviceLocation(context:Context):LocationPayload? {
 requireLocationReady(context)
 return suspendCancellableCoroutine{continuation->
  try{
   LocationServices.getFusedLocationProviderClient(context).lastLocation
    .addOnSuccessListener{location->
     if(!continuation.isActive)return@addOnSuccessListener
     if(location==null){continuation.resume(null);return@addOnSuccessListener}
     continuation.resume(runCatching{locationPayload(location)}.getOrNull())
    }
    .addOnFailureListener{if(continuation.isActive)continuation.resume(null)}
  }catch(_:SecurityException){if(continuation.isActive)continuation.resume(null)}
 }
}

suspend fun currentDeviceLocation(context:Context):LocationPayload {
 requireLocationReady(context)
 return try {
  kotlinx.coroutines.withTimeout(CURRENT_LOCATION_TIMEOUT_MS){suspendCancellableCoroutine{continuation->
   val token=com.google.android.gms.tasks.CancellationTokenSource()
   continuation.invokeOnCancellation{token.cancel()}
   LocationServices.getFusedLocationProviderClient(context).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY,token.token)
    .addOnSuccessListener{location->if(location==null)continuation.resumeWithException(LocationUnavailable())else try{continuation.resume(locationPayload(location))}catch(error:Throwable){continuation.resumeWithException(error)}}
    .addOnFailureListener{continuation.resumeWithException(it)}
  }}
 } catch(_:kotlinx.coroutines.TimeoutCancellationException){throw LocationTimedOut()}
}

fun locationFailureMessage(error:Throwable)=when(error){
 is SecurityException->"Precise location permission is required. Enable it in Android Settings."
 is LocationDisabled->"Location services are off. Turn on device location and try again."
 is LocationTimedOut->"Location is taking too long. Move outdoors and try again."
 is StaleLocation->"The available location is stale. Move outdoors and try again."
 else->"A fresh precise location is unavailable. Check GPS and try again."
}
