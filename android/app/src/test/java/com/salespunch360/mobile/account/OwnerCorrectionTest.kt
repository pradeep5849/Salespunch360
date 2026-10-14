package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.jsonPrimitive

class OwnerCorrectionTest {
 @Test fun rejectsRolledCalendarDates(){assertFalse(validOwnerCorrectionDate("2026-02-30"));assertFalse(validOwnerCorrectionDate("2026-2-01"));assertTrue(validOwnerCorrectionDate("2028-02-29"))}
 @Test fun retryRetainsTheSameSourceDateAndTrimmedReason(){val first=ownerCorrectionPayload("transaction","2026-10-14"," Duplicate entry ");assertEquals(first,ownerCorrectionPayload("transaction","2026-10-14","Duplicate entry"));assertEquals("transaction",first["transactionId"]?.jsonPrimitive?.content);assertFalse(first.containsKey("amount"));assertFalse(first.containsKey("journalEntryId"))}
 @Test fun preservesSelectedBranchOnRetry(){val payload=ownerCorrectionPayload("transaction","2026-10-14","Scoped correction","branch");assertEquals("branch",payload["branchId"]?.jsonPrimitive?.content)}
 @Test(expected=IllegalArgumentException::class) fun requiresAnActionableReason(){ownerCorrectionPayload("transaction","2026-10-14"," ")}
}
