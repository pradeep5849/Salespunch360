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
    @Test fun existingQuotationIdentityCannotBeChangedByEditingFields() {
        val prior=QuotationDraft(id="saved",revision=true,branchId="branch-a",customerId="party-a",documentType="BOQ")
        val changed=editedQuotationDraft(prior,prior.copy(id="forged",revision=false,branchId="branch-b",customerId="party-b",documentType="ESTIMATE",notes="Edited note"))
        assertEquals("saved",changed.id);assertTrue(changed.revision)
        assertEquals("branch-a",changed.branchId);assertEquals("party-a",changed.customerId);assertEquals("BOQ",changed.documentType)
        assertEquals("Edited note",changed.notes)
    }
    @Test fun newQuotationIdentityRemainsSelectable() {
        val prior=QuotationDraft()
        val changed=editedQuotationDraft(prior,prior.copy(branchId="branch-b",customerId="party-b",documentType="ESTIMATE"))
        assertEquals("branch-b",changed.branchId);assertEquals("party-b",changed.customerId);assertEquals("ESTIMATE",changed.documentType)
    }
    @Test fun creationRetryKeySurvivesEditsAndSaveNewStartsClean() {
        val draft=QuotationDraft(branchId="branch",customerId="party",documentType="ESTIMATE",notes="Saved note")
        val edited=editedQuotationDraft(draft,draft.copy(notes="Retry" ,creationRequestKey="replacement"))
        assertEquals(draft.creationRequestKey,edited.creationRequestKey)
        assertEquals(draft.creationRequestKey,quotationDraftPayload(edited)["creationRequestKey"]!!.jsonPrimitive.content)
        val fresh=freshQuotationAfterSave(edited)
        assertNotEquals(draft.creationRequestKey,fresh.creationRequestKey)
        assertEquals("branch",fresh.branchId);assertEquals("ESTIMATE",fresh.documentType)
        assertEquals("",fresh.customerId);assertEquals("",fresh.notes)
        assertNull(quotationDraftPayload(draft.copy(id="saved"))["creationRequestKey"])
    }

    @Test fun roundingSurvivesSavedRevisionAndPayloadButResetsForSaveNew(){
        val document=Json.parseToJsonElement("""{"id":"doc","status":"SENT","branchId":"branch","customerId":"party","documentType":"ESTIMATE"}""").jsonObject
        val revision=Json.parseToJsonElement("""{"issueDate":"2026-10-19","roundOffEnabled":true,"roundOffAmount":"-0.49","lines":[]}""").jsonObject
        val draft=savedQuotationDraft(document,revision)
        assertTrue(draft.roundOffEnabled);assertTrue(quotationDraftPayload(draft)["roundOffEnabled"]!!.jsonPrimitive.boolean)
        assertNull(quotationDraftPayload(draft)["roundOffAmount"])
        assertFalse(freshQuotationAfterSave(draft).roundOffEnabled)
    }
    @Test fun supplyContextSurvivesSavedSnapshotAndCanBeClearedExplicitly(){
        val document=Json.parseToJsonElement("""{"id":"doc","status":"DRAFT","branchId":"branch","customerId":"party","documentType":"QUOTATION"}""").jsonObject
        val revision=Json.parseToJsonElement("""{"issueDate":"2026-10-19","stateOfSupplyCode":"29","lines":[]}""").jsonObject
        val draft=savedQuotationDraft(document,revision)
        assertEquals("29",draft.stateOfSupplyCode);assertEquals("29",quotationDraftPayload(draft)["stateOfSupplyCode"]!!.jsonPrimitive.content)
        assertEquals(JsonNull,quotationDraftPayload(draft.copy(stateOfSupplyCode=""))["stateOfSupplyCode"])
        assertEquals("",freshQuotationAfterSave(draft).stateOfSupplyCode)
    }
}
