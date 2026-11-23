package com.salespunch360.mobile.ui
import org.junit.Assert.*
import org.junit.Test
class ReportVisitDetailsTest {
 @Test fun timestampsUseIndiaDateAndMissingCheckoutRemainsUnknown(){assertEquals("23 Nov 2026, 1:30 AM IST",reportVisitTime("2026-11-22T20:00:00Z"));assertEquals("Not recorded",reportVisitTime(null))}
 @Test fun zeroCoordinatesArePreserved(){assertEquals("0.00000, 0.00000",reportVisitCoordinates(0.0,0.0));assertEquals("Not recorded",reportVisitCoordinates(null,0.0))}
 @Test fun deleteRequiresServerEligibilityAndRevision(){
  val json=kotlinx.serialization.json.Json
  assertNull(deletableReportVisit(json.parseToJsonElement("""{"id":"v","canDelete":false,"updatedAt":"revision"}""") as kotlinx.serialization.json.JsonObject))
  assertNull(deletableReportVisit(json.parseToJsonElement("""{"id":"v","canDelete":true}""") as kotlinx.serialization.json.JsonObject))
  assertEquals("v" to "revision",deletableReportVisit(json.parseToJsonElement("""{"id":"v","canDelete":true,"updatedAt":"revision"}""") as kotlinx.serialization.json.JsonObject))
 }
}
