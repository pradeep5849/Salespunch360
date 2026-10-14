package com.salespunch360.mobile.account

import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.Json

class SalesPreviewTest {
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
}
