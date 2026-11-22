package com.salespunch360.mobile

import kotlinx.coroutines.CancellationException
import org.junit.Assert.*
import org.junit.Test

class AttendanceDeviceRecoveryTest {
 @Test fun successfulEffectsNeedNoWarning(){var calls=0;assertNull(attendanceDeviceRecovery({calls++},{calls++}));assertEquals(2,calls)}
 @Test fun trackingFailureStillSchedulesUploadsAndReturnsSafeRecovery(){var synced=false;val warning=attendanceDeviceRecovery({throw SecurityException("private detail")},{synced=true});assertTrue(synced);assertTrue(warning!!.contains("GPS tracking"));assertFalse(warning.contains("private detail"))}
 @Test fun uploadFailureDoesNotChangeTrackingResult(){var tracking=false;val warning=attendanceDeviceRecovery({tracking=true},{throw IllegalStateException()});assertTrue(tracking);assertTrue(warning!!.contains("Retry sync"))}
 @Test(expected=CancellationException::class) fun cancellationIsNotHidden(){attendanceDeviceRecovery({throw CancellationException()},{fail("Must not continue after cancellation")})}
 @Test fun recoveredStartUsesServerTime(){val a=com.salespunch360.mobile.data.Attendance("new","2026-11-22T18:40:00Z");val message=attendanceTransportRecovery(true,null,a);assertTrue(message.contains("23 Nov 2026"));assertTrue(message.contains("active"));assertFalse(message.contains("successfully"))}
 @Test fun recoveredStopDoesNotInventStopTime(){val message=attendanceTransportRecovery(false,"old",null);assertTrue(message.contains("stopped"));assertTrue(message.contains("history"));assertFalse(message.contains("successfully"))}
 @Test fun unchangedStateDoesNotClaimTheRequestSucceeded(){val a=com.salespunch360.mobile.data.Attendance("old","2026-11-22T10:00:00Z");assertTrue(attendanceTransportRecovery(false,"old",a).contains("could not be confirmed"));assertTrue(attendanceTransportRecovery(true,null,null).contains("could not be confirmed"))}
 @Test fun differentSessionIsNeverAutomaticallyStopped(){val a=com.salespunch360.mobile.data.Attendance("other","2026-11-22T10:00:00Z");assertTrue(attendanceTransportRecovery(false,"old",a).contains("different session"))}
}
