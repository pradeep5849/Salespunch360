package com.salespunch360.mobile.data

import java.time.Instant
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AttendanceRequestTimestampTest {
 @Test fun oldMeasurementTimestampSurvivesRequestSerialization(){
  val old=Instant.parse("2026-08-30T10:00:00Z").toString()
  val request=attendanceRequest("START",LocationPayload(18.5,73.8,5.0,capturedAt=old))
  val encoded=Json.encodeToString(request)
  val location=Json.parseToJsonElement(encoded).jsonObject["location"]!!.jsonObject
  assertEquals(old,request.location!!.capturedAt)
  assertEquals(18.5,location["latitude"]!!.jsonPrimitive.content.toDouble(),0.0)
  assertEquals(73.8,location["longitude"]!!.jsonPrimitive.content.toDouble(),0.0)
  assertEquals(5.0,location["accuracyMeters"]!!.jsonPrimitive.content.toDouble(),0.0)
  assertEquals(old,location["capturedAt"]!!.jsonPrimitive.content)
 }
 @Test(expected=IllegalArgumentException::class) fun attendanceRequestNeverFabricatesMissingTimestamp(){attendanceRequest("START",LocationPayload(1.0,2.0,3.0))}
 @Test(expected=IllegalArgumentException::class) fun attendanceRequestRejectsBlankTimestamp(){attendanceRequest("START",LocationPayload(1.0,2.0,3.0,capturedAt="  "))}
 @Test(expected=java.time.format.DateTimeParseException::class) fun attendanceRequestRejectsInvalidMeasurementTimestamp(){attendanceRequest("START",LocationPayload(1.0,2.0,3.0,capturedAt="not-a-time"))}
 @Test fun noLocationAttendanceRemainsStructurallySupported(){assertNull(attendanceRequest("START",null).location)}
}
