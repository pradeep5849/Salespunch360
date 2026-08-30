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
suspend fun currentDeviceLocation(context:Context):LocationPayload{if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)throw SecurityException();return suspendCancellableCoroutine{continuation->val token=com.google.android.gms.tasks.CancellationTokenSource();continuation.invokeOnCancellation{token.cancel()};LocationServices.getFusedLocationProviderClient(context).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY,token.token).addOnSuccessListener{location->if(location==null)continuation.resumeWithException(LocationUnavailable())else continuation.resume(LocationPayload(location.latitude,location.longitude,location.accuracy.toDouble()))}.addOnFailureListener{continuation.resumeWithException(it)}}}
