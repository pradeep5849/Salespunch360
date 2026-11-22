package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
import java.util.TimeZone
class AttendanceTimeTest{
 @Test fun attendanceTimeIsIndependentOfTheDeviceTimezone(){val original=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));assertEquals("5:30 AM IST",attendanceTimeIst("2026-11-22T00:00:00Z"))}finally{TimeZone.setDefault(original)}}
}
