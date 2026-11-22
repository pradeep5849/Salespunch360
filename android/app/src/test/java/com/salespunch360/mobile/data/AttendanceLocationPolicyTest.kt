package com.salespunch360.mobile.data

import org.junit.Assert.*
import org.junit.Test

class AttendanceLocationPolicyTest {
 @Test fun neitherPolicyRequestsLocation(){val f=Features(true,false);assertFalse(attendanceNeedsLocation(f,true));assertFalse(attendanceNeedsLocation(f,false));assertNull(attendanceRequest("START",null).location)}
 @Test fun geofenceOnlyValidatesStart(){val f=Features(true,false,attendanceGeofenceEnabled=true);assertTrue(attendanceNeedsLocation(f,true));assertFalse(attendanceNeedsLocation(f,false))}
 @Test fun trackingRequiresStartButNotEnd(){val f=Features(true,true);assertTrue(attendanceNeedsLocation(f,true));assertFalse(attendanceNeedsLocation(f,false))}
 @Test fun noPolicyDoesNotAcquireLocation()=kotlinx.coroutines.runBlocking{assertNull(attendanceMeasurement(Features(true,false),true){throw AssertionError("Must not request location")})}
 @Test fun successfulEndRetainsOptionalMeasurement()=kotlinx.coroutines.runBlocking{val point=LocationPayload(1.0,2.0,capturedAt="2026-11-22T10:00:00Z");assertEquals(point,attendanceMeasurement(Features(true,true),false){point})}
 @Test fun failedEndMeasurementStillAllowsStop()=kotlinx.coroutines.runBlocking{assertNull(attendanceMeasurement(Features(true,true),false){throw SecurityException("Permission revoked")})}
 @Test(expected=SecurityException::class) fun failedStartRemainsBlocked(){kotlinx.coroutines.runBlocking{attendanceMeasurement(Features(true,true),true){throw SecurityException()}}}
 @Test(expected=kotlinx.coroutines.CancellationException::class) fun optionalEndDoesNotHideCancellation(){kotlinx.coroutines.runBlocking{attendanceMeasurement(Features(true,true),false){throw kotlinx.coroutines.CancellationException()}}}
}
