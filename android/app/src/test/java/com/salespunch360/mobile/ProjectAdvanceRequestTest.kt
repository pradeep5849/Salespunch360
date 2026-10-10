package com.salespunch360.mobile
import org.junit.Test
import org.junit.Assert.*
import kotlinx.serialization.json.*
class ProjectAdvanceRequestTest{
 private fun state()=ReceiptState(loading=false,allowedTypes=listOf("CUSTOMER_RECEIPT","CUSTOMER_ADVANCE","APPLY_ADVANCE"),branchId="branch",customerId="customer",projectId="project",invoiceId="invoice",advanceId="advance",amount="50",requestKey="stable",date="2026-10-09",invoices=listOf(ReceiptInvoice("invoice","branch","customer","project","I","100")),advances=listOf(ReceiptAdvance("advance","A","branch","customer","project","80")))
 @Test fun advanceHasNoInvoiceAllocation(){val s=state().copy(type="CUSTOMER_ADVANCE");assertNull(receiptValidation(s));assertEquals(0,receiptPayload(s)["allocations"]?.jsonArray?.size);assertEquals("project",receiptPayload(s)["projectId"]?.jsonPrimitive?.content)}
 @Test fun applicationSendsOnlyLinkedAdvanceAndInvoice(){val s=state().copy(type="APPLY_ADVANCE");assertNull(receiptValidation(s));val p=receiptPayload(s)["payload"]!!.jsonObject;assertEquals("advance",p["advanceId"]?.jsonPrimitive?.content);assertEquals("invoice",p["documentId"]?.jsonPrimitive?.content);assertEquals("stable",p["idempotencyKey"]?.jsonPrimitive?.content)}
 @Test fun overApplicationAndWrongProjectAreRejected(){assertNotNull(receiptValidation(state().copy(type="APPLY_ADVANCE",amount="81")));assertNotNull(receiptValidation(state().copy(type="APPLY_ADVANCE",projectId="other")));assertNotNull(receiptValidation(state().copy(type="CUSTOMER_RECEIPT",amount="101")))}
 @Test fun retryRetainsReferenceAndInactiveFunctionsAreBlocked(){val s=state();assertEquals(receiptPayload(s),receiptPayload(s));assertNotNull(receiptValidation(s.copy(allowedTypes=emptyList())));assertNotNull(receiptValidation(s.copy(amount="Infinity")))}
}
