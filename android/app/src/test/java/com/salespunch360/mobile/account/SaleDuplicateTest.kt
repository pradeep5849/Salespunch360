package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SaleDuplicateTest{
 private val document=Json.parseToJsonElement("""{"type":"SALES_INVOICE","id":"OLD-INVOICE","documentNumber":"OLD-NUMBER","partyId":"customer","branchId":"branch","billingName":"Buyer","issueDate":"2026-01-01","dueDate":"2026-01-10","ewayBillNumber":"OLD-EWAY","allocations":[{"id":"OLD-RECEIPT"}],"lines":[{"id":"OLD-LINE","lineType":"PRODUCT","productId":"product","itemName":"Product","quantity":"2","rate":"100","taxRate":"0","batchId":"OLD-BATCH","serialNumberId":"OLD-SERIAL"}]}""").jsonObject
 @Test fun createsNewEditableDraftWithoutOriginalPaymentOrIdentity(){val draft=duplicateSavedSaleDraft(document,"2026-10-14");assertEquals("",draft.editingSourceId);assertEquals("2026-10-14",draft.issueDate);assertEquals("",draft.dueDate);assertFalse(draft.receivedEnabled);assertEquals("",draft.receivedAmount);assertEquals("Buyer",draft.billingName);assertEquals("2",draft.lines.single().quantity);assertEquals("product",draft.lines.single().sourceId);val payload=salesDraftPayload(draft).toString();assertFalse(payload.contains("OLD-"));assertFalse(payload.contains("2026-01-01"))}
 @Test fun editsToTheCopyDoNotChangeSource(){val draft=duplicateSavedSaleDraft(document,"2026-10-14");val changed=draft.copy(lines=draft.lines.map{it.copy(quantity="9")});assertEquals("9",changed.lines.single().quantity);assertEquals("2",document["lines"]!!.jsonArray.single().jsonObject["quantity"]!!.jsonPrimitive.content)}
 @Test(expected=IllegalArgumentException::class)fun rejectsNonSale(){duplicateSavedSaleDraft(buildJsonObject{put("type","PURCHASE_BILL")})}
}
