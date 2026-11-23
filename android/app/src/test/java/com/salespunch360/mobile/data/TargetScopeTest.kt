package com.salespunch360.mobile.data

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class TargetScopeTest {
 @Test fun partialActualsDoNotInventCompanyProgress() {
  val row=Json.decodeFromString<SalesTarget>("""{"id":"t","assignedUserId":"u","assignedUser":{"name":"Staff","role":"SALES"},"metric":"LEADS_CREATED_COUNT","periodType":"MONTHLY","startDate":"2026-11-01","endDate":"2026-11-30","targetValue":"20","currencyCode":"INR","version":1,"actual":"3","remaining":null,"percentage":null,"status":"SCOPE_LIMITED","targetScope":"COMPANY","actualScope":"AUTHORIZED_BRANCHES","comparisonAvailable":false,"branchActuals":[{"branchId":"b","branchName":"Branch","actual":"3"}]}""")
  assertFalse(row.comparisonAvailable)
  assertNull(row.percentage)
  assertNull(row.remaining)
  assertEquals("COMPANY",row.targetScope)
  assertEquals("3",row.branchActuals.single().actual)
 }
 @Test fun monthlyTargetsRetainSeparateBranchCounts() {
  val row=Json.decodeFromString<MonthlyTargetRow>("""{"id":"u","name":"Staff","salesRole":"SALES","leadTarget":20,"created":5,"won":2,"branchActuals":[{"branchId":"one","branchName":"First","created":3,"won":1},{"branchId":"two","branchName":"Second","created":2,"won":1}]}""")
  assertEquals(20,row.leadTarget)
  assertEquals(5,row.branchActuals.sumOf{it.created})
  assertEquals(2,row.branchActuals.sumOf{it.won})
 }
}
