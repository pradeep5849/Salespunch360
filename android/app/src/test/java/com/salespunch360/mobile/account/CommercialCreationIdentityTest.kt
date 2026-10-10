package com.salespunch360.mobile.account
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class CommercialCreationIdentityTest {
    @Test fun lostResponseRetryKeepsKeyButNewIntentAndSaveAndNewUseNewKeys() {
        var next = 0
        val identity = CommercialCreationIdentity { "request-${++next}" }
        val input = buildJsonObject { put("type", "PURCHASE_BILL"); put("materialTreatment", "DIRECT_TO_PROJECT") }
        val first = identity.payload(input)
        assertEquals(first, identity.payload(input))
        assertEquals("DIRECT_TO_PROJECT", first.str("materialTreatment"))
        val changed = buildJsonObject { input.forEach { (key, value) -> put(key, value) }; put("materialTreatment", "RECEIVE_IN_INVENTORY") }
        assertNotEquals(first.str("idempotencyKey"), identity.payload(changed).str("idempotencyKey"))
        val saved = identity.payload(changed)
        identity.reset()
        assertNotEquals(saved.str("idempotencyKey"), identity.payload(changed).str("idempotencyKey"))
    }
    @Test fun changedLineAndProjectCannotReuseOldIdentity() {
        var next = 0
        val identity = CommercialCreationIdentity { "request-${++next}" }
        fun input(project: String, quantity: String) = buildJsonObject { put("projectId", project); putJsonArray("lines") { add(buildJsonObject { put("quantity", quantity) }) } }
        val first = identity.payload(input("A", "1"))
        assertNotEquals(first.str("idempotencyKey"), identity.payload(input("A", "2")).str("idempotencyKey"))
        assertNotEquals(first.str("idempotencyKey"), identity.payload(input("B", "1")).str("idempotencyKey"))
    }
}
