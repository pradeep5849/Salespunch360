package com.salespunch360.mobile
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class ProjectChangeRequestTest {
    @Test fun creationRetriesKeepTheSameRequestReference() {
        val row=ProjectChangeDraft(title="Additional work",valueDelta="100.50",estimatedCostDelta="20")
        val one=projectChangePayload(row)
        assertEquals(one,projectChangePayload(row))
        assertEquals(row.requestKey,one["payload"]!!.jsonObject["idempotencyKey"]!!.jsonPrimitive.content)
        assertEquals("CREATE",one["operation"]!!.jsonPrimitive.content)
    }
    @Test fun editKeepsIdentityAndUsesTheEditOperation() {
        val row=ProjectChangeDraft(id="change-id",title="Revised work",valueDelta="-50.25",estimatedCostDelta="-10")
        assertTrue(validProjectChange(row))
        val body=projectChangePayload(row)
        assertEquals("EDIT",body["operation"]!!.jsonPrimitive.content)
        assertEquals("change-id",body["payload"]!!.jsonObject["changeOrderId"]!!.jsonPrimitive.content)
        assertFalse(body["payload"]!!.jsonObject.containsKey("idempotencyKey"))
    }
    @Test fun rejectsNonFiniteMoneyOverPrecisionAndInvalidFields() {
        assertFalse(validProjectChange(ProjectChangeDraft(title=" ")))
        assertFalse(validProjectChange(ProjectChangeDraft(title="Work",valueDelta="NaN")))
        assertFalse(validProjectChange(ProjectChangeDraft(title="Work",valueDelta="1.234")))
        assertFalse(validProjectChange(ProjectChangeDraft(title="Work",estimatedCostDelta="10000000000000000")))
    }
}
