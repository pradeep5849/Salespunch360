package com.salespunch360.mobile

import kotlinx.serialization.json.*
import com.salespunch360.mobile.account.SalesLineDraft
import org.junit.Assert.*
import org.junit.Test

class QuotationDraftCodecTest {
    @Test fun revisionRoundTripKeepsPricesDiscountsUnitsAndSupportingRowsWithoutCostDisclosure() {
        val document = Json.parseToJsonElement("""{"id":"document","status":"SENT","branchId":"branch","customerId":"party","documentType":"QUOTATION"}""").jsonObject
        val revision = Json.parseToJsonElement("""{"issueDate":"2026-10-11T00:00:00Z","validUntil":null,"customFields":{"site":"A"},"lines":[{"id":"old-line","lineType":"CUSTOM","itemName":"Fitout","unitId":"unit","unitName":"Square feet","unitSymbol":"sqft","specification":"Finish A","quantity":"2.5","rate":"120.75","discountType":"PERCENTAGE","discountValue":"10","taxRate":"18","internalUnitCost":"80"}],"adjustments":[{"id":"old-adjustment","type":"ADDITIONAL_CHARGE","label":"Delivery","valueType":"FIXED","value":"20","taxable":true,"taxRate":"18","amount":"20"}],"paymentSchedule":[{"id":"old-schedule","label":"Advance","valueType":"PERCENTAGE","value":"100","dueDescription":"Before delivery","amount":"350"}]}""").jsonObject
        val draft = savedQuotationDraft(document, revision)
        assertTrue(draft.revision); assertEquals("", draft.validUntil)
        val request = quotationDraftPayload(draft.copy(notes = "Edited note"))
        val line = request["lines"]!!.jsonArray.single().jsonObject
        assertEquals("2.5", line["quantity"]!!.jsonPrimitive.content)
        assertEquals("120.75", line["rate"]!!.jsonPrimitive.content)
        assertEquals("10", line["discountValue"]!!.jsonPrimitive.content)
        assertEquals("old-line", line["existingLineId"]!!.jsonPrimitive.content)
        assertEquals("unit", line["unitId"]!!.jsonPrimitive.content)
        assertEquals("sqft", line["unitSymbol"]!!.jsonPrimitive.content)
        assertEquals("Finish A", line["specification"]!!.jsonPrimitive.content)
        assertNull(line["internalUnitCost"])
        assertNull(request["validUntil"])
        val charge = request["adjustments"]!!.jsonArray.single().jsonObject
        assertEquals("20", charge["value"]!!.jsonPrimitive.content); assertNull(charge["id"]); assertNull(charge["amount"])
        val schedule = request["paymentSchedule"]!!.jsonArray.single().jsonObject
        assertEquals("100", schedule["value"]!!.jsonPrimitive.content); assertNull(schedule["id"])
        assertEquals("A", request["customFields"]!!.jsonObject["site"]!!.jsonPrimitive.content)
    }
    @Test fun freshQuotationHasNoInheritedSupportingRows() {
        val request = quotationDraftPayload(QuotationDraft(branchId="branch",customerId="party"))
        assertEquals(0, request["adjustments"]!!.jsonArray.size)
        assertEquals(0, request["paymentSchedule"]!!.jsonArray.size)
        assertNull(request["lines"]!!.jsonArray.single().jsonObject["existingLineId"])
    }
    @Test fun replacingItemClearsOldIdentityAndUnitButChangingQuantityKeepsThem() {
        val line = SalesLineDraft(lineType="PRODUCT",sourceId="original",unitName="Old unit",unitSymbol="old")
        val draft = QuotationDraft(lines=listOf(line),lineMetadata=listOf(buildJsonObject { put("existingLineId","old-line");put("unitId","old-unit") }))
        val quantityEdit = editedQuotationLine(draft,0,line.copy(quantity="3"))
        assertEquals("old-line",quotationDraftPayload(quantityEdit)["lines"]!!.jsonArray.single().jsonObject["existingLineId"]!!.jsonPrimitive.content)
        val replacement = editedQuotationLine(draft,0,line.copy(sourceId="replacement"))
        val requestLine = quotationDraftPayload(replacement)["lines"]!!.jsonArray.single().jsonObject
        assertNull(requestLine["existingLineId"]);assertNull(requestLine["unitId"])
        assertNull(requestLine["unitName"])
    }
    @Test fun deletingFirstLineKeepsSecondLinesOwnMetadata() {
        val draft = QuotationDraft(lines=listOf(SalesLineDraft(itemName="First"),SalesLineDraft(itemName="Second")),lineMetadata=listOf(buildJsonObject { put("existingLineId","first") },buildJsonObject { put("existingLineId","second") }))
        val remaining = removedQuotationLine(draft,0)
        assertEquals("Second",remaining.lines.single().itemName)
        assertEquals("second",quotationDraftPayload(remaining)["lines"]!!.jsonArray.single().jsonObject["existingLineId"]!!.jsonPrimitive.content)
    }
}
