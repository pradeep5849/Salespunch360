package com.salespunch360.mobile.location
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.salespunch360.mobile.data.LocationPayload
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
class LocationUnavailable:Exception()
class LocationDisabled:Exception();class LocationTimedOut:Exception()
suspend fun currentDeviceLocation(context:Context):LocationPayload{if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)throw SecurityException();val manager=context.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager;if(!manager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)&&!manager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER))throw LocationDisabled();return try{kotlinx.coroutines.withTimeout(15_000){suspendCancellableCoroutine{continuation->val token=com.google.android.gms.tasks.CancellationTokenSource();continuation.invokeOnCancellation{token.cancel()};LocationServices.getFusedLocationProviderClient(context).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY,token.token).addOnSuccessListener{location->if(location==null)continuation.resumeWithException(LocationUnavailable())else continuation.resume(LocationPayload(location.latitude,location.longitude,location.accuracy.toDouble()))}.addOnFailureListener{continuation.resumeWithException(it)}}}}catch(_:kotlinx.coroutines.TimeoutCancellationException){throw LocationTimedOut()}}
fun locationFailureMessage(error:Throwable)=when(error){is SecurityException->"Precise location permission is required. Enable it in Android Settings.";is LocationDisabled->"Location services are off. Turn on device location and try again.";is LocationTimedOut->"A fresh location timed out. Move outdoors and try again.";else->"A fresh precise location is unavailable. Check GPS and try again."}
