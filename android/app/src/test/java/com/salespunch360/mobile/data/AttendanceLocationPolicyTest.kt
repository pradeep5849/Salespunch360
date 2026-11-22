package com.salespunch360.mobile.data

import org.junit.Assert.*
import org.junit.Test

class AttendanceLocationPolicyTest {
 @Test fun neitherPolicyRequestsLocation(){val f=Features(true,false);assertFalse(attendanceNeedsLocation(f,true));assertFalse(attendanceNeedsLocation(f,false));assertNull(attendanceRequest("START",null).location)}
 @Test fun geofenceOnlyValidatesStart(){val f=Features(true,false,attendanceGeofenceEnabled=true);assertTrue(attendanceNeedsLocation(f,true));assertFalse(attendanceNeedsLocation(f,false))}
 @Test fun trackingRequestsBothMeasurements(){val f=Features(true,true);assertTrue(attendanceNeedsLocation(f,true));assertTrue(attendanceNeedsLocation(f,false))}
}
