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
 @Test fun discountAndCashFullySettleWithoutIncreasingCash(){val s=state().copy(amount="90",discountAmount="10",discountEnabled=true);assertNull(receiptValidation(s));val p=receiptPayload(s);assertEquals("90",p["amount"]?.jsonPrimitive?.content);val allocation=p["allocations"]!!.jsonArray[0].jsonObject;assertEquals("100",allocation["amount"]?.jsonPrimitive?.content);assertEquals("10",allocation["discountAmount"]?.jsonPrimitive?.content)}
 @Test fun excessiveAndInvalidDiscountsAreRejected(){assertNotNull(receiptValidation(state().copy(amount="90",discountAmount="11",discountEnabled=true)));assertNotNull(receiptValidation(state().copy(discountAmount="1e1",discountEnabled=true)));val p=receiptPayload(state().copy(amount="90",discountAmount="10",discountEnabled=false));assertEquals("90",p["allocations"]!!.jsonArray[0].jsonObject["amount"]?.jsonPrimitive?.content)}

 @Test fun multipleInvoiceLinksKeepCashAndResidualSeparate(){
  val s=state().copy(multipleLinks=true,invoiceId="",amount="150",links=mapOf("invoice" to "40","second" to "60"),invoices=state().invoices+ReceiptInvoice("second","branch","customer","project","II","80"))
  assertNull(receiptValidation(s));val p=receiptPayload(s)
  assertEquals("150",p["amount"]?.jsonPrimitive?.content)
  assertEquals(listOf("40","60"),p["allocations"]!!.jsonArray.map{it.jsonObject["amount"]!!.jsonPrimitive.content})
  assertNotNull(receiptValidation(s.copy(amount="90")))
  assertNotNull(receiptValidation(s.copy(links=mapOf("other-company" to "1"))))
 }
 @Test fun emptyMultipleLinksPrepareOneUnusedAdvance(){
  val s=state().copy(multipleLinks=true,invoiceId="",links=emptyMap())
  assertNull(receiptValidation(s));assertEquals(0,receiptPayload(s)["allocations"]!!.jsonArray.size)
 }
}
