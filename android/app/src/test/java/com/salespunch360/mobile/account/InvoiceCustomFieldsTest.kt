package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import com.salespunch360.mobile.ui.account.sales.invoiceCustomFieldsValid

class InvoiceCustomFieldsTest {
 @Test fun editedSaleRetainsTypedFieldsWhileNewSaleStartsEmpty(){
  val document=Json.parseToJsonElement("""{"id":"sale","customValues":{"confirmed":false,"rate":"Onsite","measurement":12}}""").jsonObject
  val edited=savedSaleEditorDraft(document)
  assertEquals(mapOf("confirmed" to "false","rate" to "Onsite","measurement" to "12"),edited.customFields)
  assertEquals("false",salesDraftPayload(edited)["customFields"]!!.jsonObject["confirmed"]!!.jsonPrimitive.content)
  assertTrue(SalesOptions().defaultSalesDraft("SALES_INVOICE","branch").customFields.isEmpty())
 }
 @Test fun requiredFieldsApplyOnlyToTheirDocumentTypeAndAcceptFalse(){
  val fields=listOf(Json.parseToJsonElement("""{"entityType":"SALES_INVOICE","fieldKey":"confirmed","isRequired":true}""").jsonObject)
  assertFalse(invoiceCustomFieldsValid(fields,"SALES_INVOICE",emptyMap()))
  assertTrue(invoiceCustomFieldsValid(fields,"SALES_INVOICE",mapOf("confirmed" to "false")))
  assertTrue(invoiceCustomFieldsValid(fields,"CREDIT_NOTE",emptyMap()))
 }
 @Test fun purchasePayloadPreservesExplicitClearingAndDoesNotAttachBillFieldsToOrder(){
  val draft=PurchaseDraft(customFields=mapOf("site" to "SITE-1","optional" to ""))
  assertEquals("",purchasePayload(draft)["customFields"]!!.jsonObject["optional"]!!.jsonPrimitive.content)
  assertNull(purchasePayload(draft.copy(type="PURCHASE_ORDER"))["customFields"])
 }
}
