package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SalesEditSnapshotTest {
    @Test fun shippingAddressSnapshotSurvivesEditsAndSupportsExplicitClearing() {
        val doc=Json.parseToJsonElement("""{"id":"sale","shippingAddress":"Original site\nStreet 2","lines":[]}""").jsonObject
        val draft=savedSaleEditorDraft(doc)
        assertEquals("Original site\nStreet 2",draft.shippingAddress)
        assertEquals(draft.shippingAddress,salesDraftPayload(draft)["shippingAddress"]!!.jsonPrimitive.content)
        assertEquals("",salesDraftPayload(draft.copy(shippingAddress=""))["shippingAddress"]!!.jsonPrimitive.content)
        assertEquals("Original site\nStreet 2",draft.shippingAddress)
    }

    @Test fun savedInvoiceRetainsCessSpecificationAndChargesWhenQuantityChanges() {
        val document=Json.parseToJsonElement("""{"id":"sale","taxableTotal":"100","tdsAmount":"1","tcsAmount":"2","freightAmount":"5","otherChargesAmount":"7","roundOffAmount":"0.25","taxMode":"INCLUSIVE","lines":[{"lineType":"CUSTOM","itemName":"Custom service","itemCode":"SAVED","specification":"Original specification","quantity":"1","rate":"120","taxRate":"18","cessRate":"2"}]}""").jsonObject
        val restored=savedSaleEditorDraft(document)
        val edited=restored.copy(lines=restored.lines.map{it.copy(quantity="2")})
        val request=salesDraftPayload(edited)
        val line=request["lines"]!!.jsonArray.single().jsonObject
        assertEquals("Original specification",line["specification"]!!.jsonPrimitive.content)
        assertEquals("SAVED",line["itemCode"]!!.jsonPrimitive.content)
        assertEquals("2",line["cessRate"]!!.jsonPrimitive.content)
        assertEquals("1",request["tdsRate"]!!.jsonPrimitive.content)
        assertEquals("5",request["freightAmount"]!!.jsonPrimitive.content)
        assertEquals("7",request["otherChargesAmount"]!!.jsonPrimitive.content)
        assertEquals("0.25",request["roundOffAmount"]!!.jsonPrimitive.content)
        // 200 taxable + 36 GST + 4 cess + 4 TCS + 12 charges + .25 rounding.
        assertEquals("256.25",salesPreviewTotal(edited,SalesOptions()).toPlainString())
        // The source draft remains unchanged by the edit.
        assertEquals("1",restored.lines.single().quantity)
    }
    @Test fun editingPreservesChargeTrackingAndReminderSnapshotsThroughRequest() {
        val document=Json.parseToJsonElement("""{"id":"sale","type":"SALES_INVOICE","reverseCharge":true,"branchId":"branch","partyId":"party","projectId":"project","issueDate":"2026-10-11","taxMode":"INCLUSIVE","lines":[{"lineType":"PRODUCT","productId":"product","itemName":"Tracked product","quantity":"1","rate":"118","taxRate":"18","warehouseId":"warehouse","batchId":"batch","serialNumberId":"serial","servicePeriodDays":60}]}""").jsonObject
        val draft=savedSaleEditorDraft(document)
        assertTrue(draft.reverseCharge)
        assertEquals("project",draft.projectId)
        val request=salesDraftPayload(draft)
        assertTrue(request["reverseCharge"]!!.jsonPrimitive.boolean)
        assertEquals("INCLUSIVE",request["taxMode"]!!.jsonPrimitive.content)
        assertNull(request["receivedInFull"])
        val line=request["lines"]!!.jsonArray.single().jsonObject
        assertEquals("batch",line["batchId"]!!.jsonPrimitive.content)
        assertEquals("serial",line["serialNumberId"]!!.jsonPrimitive.content)
        assertEquals(60,line["servicePeriodDays"]!!.jsonPrimitive.int)
    }
    @Test fun editingRetainsTcsWhenTheDetailContainsAmountsInsteadOfARate() {
        val doc=Json.parseToJsonElement("""{"taxableTotal":"100","tcsAmount":"10","lines":[]}""").jsonObject
        val draft=savedSaleEditorDraft(doc)
        assertEquals("10",draft.tcsRate)
        assertEquals("10",salesDraftPayload(draft)["tcsRate"]!!.jsonPrimitive.content)
    }
    @Test fun newPaidAndFreeSerialRequestsUseDistinctTrackingIds() {
        val lines=saleLinesWithFreeItem(SalesLineDraft(sourceId="product",rate="100",quantity="1",warehouseId="warehouse",serialNumberId="paid"),"1","SERIAL","free")
        val request=salesDraftPayload(SalesEditorDraft(customerId="party",lines=lines))
        assertEquals(listOf("paid","free"),request["lines"]!!.jsonArray.map{it.jsonObject["serialNumberId"]!!.jsonPrimitive.content})
        assertEquals(listOf("100","0"),request["lines"]!!.jsonArray.map{it.jsonObject["rate"]!!.jsonPrimitive.content})
    }
    @Test fun legacyFixedDiscountUsesThePostedAmountWithoutChangingSource() {
        val doc=Json.parseToJsonElement("""{"id":"sale","lines":[{"id":"line","lineType":"CUSTOM","quantity":"3","rate":"20","discountType":"FIXED","discountValue":null,"discountAmount":"3","taxRate":"0"}]}""").jsonObject
        val draft=savedSaleEditorDraft(doc)
        assertEquals("3",draft.lines.single().discountValue)
        assertEquals("57.00",salesPreviewTotal(draft,SalesOptions()).setScale(2).toPlainString())
        assertEquals("3",salesDraftPayload(draft)["lines"]!!.jsonArray.single().jsonObject["discountValue"]!!.jsonPrimitive.content)
        assertEquals(JsonNull,doc["lines"]!!.jsonArray.single().jsonObject["discountValue"])
    }
    @Test fun restoredDiscountKeepsExplicitZeroAndDoesNotGuessPercentages() {
        val doc=Json.parseToJsonElement("""{"lines":[{"discountType":"FIXED","discountValue":"0","discountAmount":"3"},{"discountType":"PERCENTAGE","discountValue":null,"discountAmount":"3"}]}""").jsonObject
        val restored=savedSaleEditorDraft(doc).lines
        assertEquals("0",restored[0].discountValue)
        assertEquals("",restored[1].discountValue)
    }

 @Test fun copiedSecondaryUnitsSubmitSourceIdsButNeverClientConversionMetadata(){
  val document=Json.parseToJsonElement("""{"id":"sale","type":"SALES_INVOICE","branchId":"branch","partyId":"party","lines":[{"id":"line","lineType":"PRODUCT","productId":"product","quantity":"1","rate":"200","unitConversionSnapshot":{"selection":"SECONDARY","secondaryUnitsPerBase":"0.1"}}]}""").jsonObject
  val saved=savedSaleEditorDraft(document);assertEquals("SECONDARY",saved.lines.single().unitSelection)
  val copied=duplicateSavedSaleDraft(document,"2026-10-20");val payload=salesDraftPayload(copied);val line=payload["lines"]!!.jsonArray.single().jsonObject
  assertEquals("sale",payload["copiedFromSaleId"]!!.jsonPrimitive.content);assertEquals("line",line["copiedFromSaleLineId"]!!.jsonPrimitive.content)
  assertEquals("SECONDARY",line["unitSelection"]!!.jsonPrimitive.content);assertNull(line["secondaryUnitsPerBase"]);assertNull(line["unitConversionSnapshot"]);assertNull(line["originalLineId"])
 }
}
