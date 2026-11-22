package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class GeofenceReportFiltersTest{
 @Test fun eventTypeDoesNotCollideWithReportRouting(){assertEquals(listOf("action=ATTENDANCE_START","geofenceType=OUTSIDE_RADIUS","q=A%26B"),GeofenceReportFilters("ATTENDANCE_START","OUTSIDE_RADIUS"," A&B ").parameters("geofence"))}
 @Test fun ignoresUnrelatedReportsAndDefaults(){assertTrue(GeofenceReportFilters().parameters("geofence").isEmpty());assertTrue(GeofenceReportFilters("ATTENDANCE_START").parameters("leads").isEmpty())}
}
