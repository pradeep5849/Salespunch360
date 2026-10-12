package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ChequeActionsTest {
    private val row=buildJsonObject{put("actionVersion",3);put("moneyAccountId","recorded-bank")}
    @Test fun closeUsesTheConfirmedDestinationAndPreservesRetryVersion() {
        val payload=chequeActionPayload(row,"CLOSE","2026-10-12","unused","stable-request","cash-account"," Cash closure ")
        assertEquals("cash-account",payload["moneyAccountId"]?.jsonPrimitive?.content)
        assertEquals(3,payload["expectedVersion"]?.jsonPrimitive?.int)
        assertEquals("stable-request",payload["requestKey"]?.jsonPrimitive?.content)
        assertEquals("Cash closure",payload["description"]?.jsonPrimitive?.content)
        assertFalse(payload.containsKey("reason"))
    }
    @Test fun correctionsExcludeClosureOnlyFieldsSoTheStrictApiAcceptsThem() {
        listOf("REOPEN","BOUNCE","CANCEL").forEach{action->
            val payload=chequeActionPayload(row,action,"2026-10-13"," Original correction ","stable-request","cash-account","old description")
            assertEquals("Original correction",payload["reason"]?.jsonPrimitive?.content)
            assertFalse(payload.containsKey("moneyAccountId"));assertFalse(payload.containsKey("description"))
        }
    }
}
