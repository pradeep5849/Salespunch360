package com.salespunch360.mobile

import kotlinx.coroutines.CancellationException
import org.junit.Assert.*
import org.junit.Test

class AttendanceDeviceRecoveryTest {
 @Test fun successfulEffectsNeedNoWarning(){var calls=0;assertNull(attendanceDeviceRecovery({calls++},{calls++}));assertEquals(2,calls)}
 @Test fun trackingFailureStillSchedulesUploadsAndReturnsSafeRecovery(){var synced=false;val warning=attendanceDeviceRecovery({throw SecurityException("private detail")},{synced=true});assertTrue(synced);assertTrue(warning!!.contains("GPS tracking"));assertFalse(warning.contains("private detail"))}
 @Test fun uploadFailureDoesNotChangeTrackingResult(){var tracking=false;val warning=attendanceDeviceRecovery({tracking=true},{throw IllegalStateException()});assertTrue(tracking);assertTrue(warning!!.contains("Retry sync"))}
 @Test(expected=CancellationException::class) fun cancellationIsNotHidden(){attendanceDeviceRecovery({throw CancellationException()},{fail("Must not continue after cancellation")})}
}
