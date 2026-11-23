package com.salespunch360.mobile.data

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class AttendanceBranchTest {
 private val choices=listOf(AttendanceBranch("a","Office A"),AttendanceBranch("b","Office B"))
 @Test fun multipleBranchesRequireExplicitValidChoice(){assertNull(attendanceBranchId(choices,null,null));assertNull(attendanceBranchId(choices,"foreign",null));assertEquals("b",attendanceBranchId(choices,"b",null))}
 @Test fun singleLocationSelectsItsOnlyAuthorityWithoutPicker(){assertEquals("a",attendanceBranchId(choices.take(1),null,null));assertNull(attendanceBranchId(emptyList(),null,null))}
 @Test fun endUsesPersistedBranchInsteadOfNewSelection(){val active=Attendance("visit","2026-11-23T05:00Z",branchId="b");assertEquals("b",attendanceBranchId(choices,"a",active))}
 @Test fun requestCarriesChosenBranchAndRetainsMeasurementTime(){val point=LocationPayload(1.0,2.0,capturedAt="2026-11-23T05:00:00Z");val json=Json.parseToJsonElement(Json.encodeToString(attendanceRequest("START",point,"b"))).jsonObject;assertEquals("b",json["branchId"]?.jsonPrimitive?.content);assertEquals(point.capturedAt,json["location"]?.jsonObject?.get("capturedAt")?.jsonPrimitive?.content)}
 @Test fun olderActiveDtoCanEndOnItsOnlyBranch(){assertEquals("a",attendanceBranchId(choices.take(1),null,Attendance("active","2026-11-23T05:00Z")))}
}
