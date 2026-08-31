package com.salespunch360.mobile.location

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class DeviceLocationTimestampTest {
 @Test fun currentMeasurementPreservesLocationWallClockTime(){
  val measured=1_725_000_000_123L
  val payload=locationPayload(18.5,73.8,4.25,measured)
  assertEquals(18.5,payload.latitude,0.0)
  assertEquals(73.8,payload.longitude,0.0)
  assertEquals(4.25,payload.accuracyMeters!!,0.0)
  assertEquals(Instant.ofEpochMilli(measured).toString(),payload.capturedAt)
 }
 @Test fun oldMeasurementRetainsOldWallClockTime(){
  val old=1_725_000_000_000L
  assertEquals(Instant.ofEpochMilli(old).toString(),locationPayload(1.0,2.0,3.0,old).capturedAt)
 }
 @Test fun androidLocationConversionPreservesItsMeasurementTime(){
  val measured=1_725_000_000_123L
  val elapsed=400_000_000_000L
  val location=mock(android.location.Location::class.java)
  `when`(location.latitude).thenReturn(18.5)
  `when`(location.longitude).thenReturn(73.8)
  `when`(location.accuracy).thenReturn(4.25f)
  `when`(location.time).thenReturn(measured)
  `when`(location.elapsedRealtimeNanos).thenReturn(elapsed)
  val payload=locationPayload(location,elapsed+1_000_000_000L)
  assertEquals(18.5,payload.latitude,0.0)
  assertEquals(73.8,payload.longitude,0.0)
  assertEquals(4.25,payload.accuracyMeters!!,0.0)
  assertEquals(Instant.ofEpochMilli(measured).toString(),payload.capturedAt)
 }
 @Test fun monotonicAgeAcceptsFreshMeasurement(){val now=500_000_000_000L;assertTrue(isLocationMeasurementFresh(now-119_000_000_000L,now))}
 @Test fun monotonicAgeRejectsStaleMeasurement(){val now=500_000_000_000L;assertFalse(isLocationMeasurementFresh(now-121_000_000_000L,now))}
 @Test fun monotonicAgeRejectsFutureMeasurement(){val now=500_000_000_000L;assertFalse(isLocationMeasurementFresh(now+31_000_000_000L,now))}
 @Test fun monotonicAgeRejectsMissingMeasurement(){assertFalse(isLocationMeasurementFresh(0L,500_000_000_000L))}
 @Test fun monotonicAgeRejectsNegativeMeasurement(){assertFalse(isLocationMeasurementFresh(-1L,500_000_000_000L))}
 @Test(expected=StaleLocation::class) fun missingWallClockMeasurementFailsClosed(){locationPayload(1.0,2.0,3.0,0L)}
}
