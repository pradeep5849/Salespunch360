package com.salespunch360.mobile
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class ProjectCreationRequestTest {
    @Test fun retryPreservesTheOriginalRequestIdentityAndBusinessFields() {
        val intent=buildJsonObject { put("name","Project A");put("branchId","branch");put("projectValue","100") }
        val payload=projectCreationPayload(intent,"original-request")
        assertEquals(payload,projectCreationPayload(intent,"original-request"))
        assertEquals("100",payload["projectValue"]!!.jsonPrimitive.content)
        assertEquals("original-request",payload["idempotencyKey"]!!.jsonPrimitive.content)
        assertFalse(intent.containsKey("idempotencyKey"))
    }
    @Test fun changedIntentCanUseANewRequestWithoutChangingThePreviousPayload() {
        val intent=buildJsonObject { put("name","Project A") }
        assertNotEquals(projectCreationPayload(intent,"request-1"),projectCreationPayload(intent,"request-2"))
    }
}
