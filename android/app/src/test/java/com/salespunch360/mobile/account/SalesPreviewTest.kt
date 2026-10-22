package com.salespunch360.mobile.account

import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.Json

class SalesPreviewTest {
    @Test fun editedChargesChangePreviewAndPayloadWithoutChangingOriginalDraft() {
        val original=SalesEditorDraft(editingSourceId="saved",freightAmount="5",otherChargesAmount="7",roundOffAmount="0.25",lines=listOf(SalesLineDraft(sourceId="service",quantity="2",rate="120")))
        val edited=original.copy(freightAmount="13.50",otherChargesAmount="8.25")
        assertEquals("252.25",salesPreviewTotal(original,SalesOptions()).toPlainString())
        assertEquals("262.00",salesPreviewTotal(edited,SalesOptions()).toPlainString())
        assertEquals("13.50",salesDraftPayload(edited)["freightAmount"]?.jsonPrimitive?.content)
        assertEquals("8.25",salesDraftPayload(edited)["otherChargesAmount"]?.jsonPrimitive?.content)
    }

    @Test fun advancesRespectCustomerBranchProjectAndLinkingSwitch() {
        val draft=SalesEditorDraft(branchId="branch",customerId="customer",lines=listOf(SalesLineDraft(quantity="1",rate="100")))
        val options=SalesOptions(customerAdvances=listOf(
            Json.parseToJsonElement("""{"partyId":"customer","branchId":"branch","projectId":null,"remainingAmount":"40"}""").let{it as kotlinx.serialization.json.JsonObject},
            Json.parseToJsonElement("""{"partyId":"customer","branchId":"other","projectId":null,"remainingAmount":"500"}""").let{it as kotlinx.serialization.json.JsonObject}))
        assertEquals(40,salesPreviewAdvance(draft,options).toInt())
        assertEquals(0,salesPreviewAdvance(draft.copy(projectId="project"),options).toInt())
        assertEquals(0,salesPreviewAdvance(draft.copy(customerId="other"),options).toInt())
        val off=Json.parseToJsonElement("""{"transactionPreferences":{"linkPayments":false}}""") as kotlinx.serialization.json.JsonObject
        assertEquals(0,salesPreviewAdvance(draft,options.copy(transactionDefaults=off)).toInt())
    }
    @Test fun reverseChargeExcludesGstFromExclusiveAndInclusivePayable() {
        val exclusive=SalesEditorDraft(reverseCharge=true,lines=listOf(SalesLineDraft(quantity="1",rate="100",taxRate="18")))
        assertEquals("100.00",salesPreviewTotal(exclusive,SalesOptions()).toPlainString())
        val inclusive=exclusive.copy(taxMode="INCLUSIVE",lines=listOf(SalesLineDraft(quantity="1",rate="118",taxRate="18")))
        assertEquals("100.00",salesPreviewTotal(inclusive,SalesOptions()).toPlainString())
    }
    @Test fun inclusivePricesAndWholeInvoiceDiscountsHaveCorrectTotals() {
        val line=SalesLineDraft(sourceId="item",quantity="1",rate="118",taxRate="18")
        val draft=SalesEditorDraft(taxMode="INCLUSIVE",lines=listOf(line))
        assertEquals("118.00",salesPreviewTotal(draft,SalesOptions()).toPlainString())
        assertEquals("106.20",salesPreviewTotal(draft.copy(transactionDiscount="10"),SalesOptions()).toPlainString())
    }
    @Test fun freeItemsConsumeCostAndUnknownCostsDoNotShowFalseProfit() {
        val draft=SalesEditorDraft(lines=listOf(SalesLineDraft(sourceId="item",quantity="1",rate="100"),SalesLineDraft(sourceId="item",quantity="1",rate="0")))
        assertNull(salesPreviewProfit(draft,SalesOptions()))
        val options=SalesOptions(products=listOf(SalesOption("item","Item",costPrice="30")))
        assertEquals("40.00",salesPreviewProfit(draft,options)?.toPlainString())
    }
    @Test fun invalidPartialTaxInputDoesNotCrashTheEditor() {
        assertEquals("118.00",salesPreviewTotal(SalesEditorDraft(taxMode="INCLUSIVE",transactionTaxRate="-100",lines=listOf(SalesLineDraft(quantity="1",rate="118"))),SalesOptions()).toPlainString())
    }
    @Test fun previewRoundsBaseAndDiscountBeforeTaxLikeTheServer() {
        val line=SalesLineDraft(quantity="3",rate="0.335",taxRate="18",cessRate="2",discountType="PERCENTAGE",discountValue="33.335")
        assertEquals("0.67",salesPreviewTotal(SalesEditorDraft(taxMode="INCLUSIVE",lines=listOf(line)),SalesOptions()).toPlainString())
        val fixed=line.copy(quantity="0.125",rate="100.04",discountType="FIXED",discountValue="0.005")
        assertEquals("12.51",salesPreviewTotal(SalesEditorDraft(taxMode="INCLUSIVE",lines=listOf(fixed)),SalesOptions()).toPlainString())
    }
    @Test fun inclusivePreviewMatchesDocumentAggregationAndReverseChargeRemovesCessToo() {
        val tiny=SalesLineDraft(quantity="1",rate="0.03",taxRate="18")
        assertEquals("0.04",salesPreviewTotal(SalesEditorDraft(taxMode="INCLUSIVE",lines=listOf(tiny)),SalesOptions()).toPlainString())
        val cess=SalesLineDraft(quantity="1",rate="120",taxRate="18",cessRate="2")
        assertEquals("100.00",salesPreviewTotal(SalesEditorDraft(taxMode="INCLUSIVE",reverseCharge=true,lines=listOf(cess)),SalesOptions()).toPlainString())
    }


 @Test fun secondaryProfitUsesPrimaryCostQuantities(){
  val draft=SalesEditorDraft(lines=listOf(SalesLineDraft(sourceId="item",quantity="1",rate="200",unitSelection="SECONDARY",secondaryUnitsPerBase="0.1")))
  assertEquals("100.00",salesPreviewProfit(draft,SalesOptions(products=listOf(SalesOption("item","Item",costPrice="10"))))?.toPlainString())
 }
}
