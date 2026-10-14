package com.salespunch360.mobile.account

import java.util.UUID
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class MoneyAccountRequestTest {
    private val draft = buildJsonObject { put("type", "BANK"); put("name", "Bank"); put("branchId", ""); put("accountNumberMasked", "****1234") }
    @Test fun retryRetainsIdentityAndDraftWithoutMutatingInputs() {
        val key = UUID.randomUUID().toString()
        assertEquals(moneyAccountCreationPayload(draft,key),moneyAccountCreationPayload(draft,key))
        assertEquals("****1234",moneyAccountCreationPayload(draft,key)["accountNumberMasked"]?.jsonPrimitive?.content)
        assertFalse(draft.containsKey("creationRequestKey"))
    }
    @Test fun explicitNewOperationHasANewIdentity() {
        assertNotEquals(moneyAccountCreationPayload(draft,UUID.randomUUID().toString()),moneyAccountCreationPayload(draft,UUID.randomUUID().toString()))
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsInvalidIdentity() {
        moneyAccountCreationPayload(draft,"invalid")
    }
}
