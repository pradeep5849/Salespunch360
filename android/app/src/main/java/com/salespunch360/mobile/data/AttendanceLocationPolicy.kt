package com.salespunch360.mobile.data

/** Geofencing validates the start; tracking can also record an end location. */
internal fun attendanceNeedsLocation(features:Features,start:Boolean):Boolean =
 features.gpsTrackingEnabled || (start && features.attendanceGeofenceEnabled)
