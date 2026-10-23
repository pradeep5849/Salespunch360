package com.salespunch360.mobile.account
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class SavedSalePaymentsTest {
    private fun source()=Json.parseToJsonElement("""{"id":"sale","type":"SALES_INVOICE","status":"POSTED","branchId":"branch","partyId":"party","paymentSummary":{"received":"90.00","paymentDiscount":"10.00","advanceApplied":"5.00","outstanding":"0.00"},"allocations":[{"amount":"100","discountAmount":"10","settlement":{"type":"CUSTOMER_RECEIPT","status":"POSTED","paymentMode":"BANK","transactionDate":"2026-10-19T00:00:00.000Z","reference":"Saved ref"}},{"amount":"50","settlement":{"type":"CUSTOMER_RECEIPT","status":"PENDING_CHEQUE"}}],"lines":[]}""").jsonObject
    @Test fun restoresSavedReceiptRatherThanRepostingFullSettlement(){val draft=savedSaleEditorDraft(source());val saved=draft.recordedPayments!!;assertEquals("90.00",saved.received);assertEquals("10.00",saved.discount);assertEquals("5.00",saved.advance);assertEquals("0.00",saved.outstanding);assertEquals(listOf(SavedSaleReceipt("90","2026-10-19","BANK","Saved ref")),saved.receipts);assertFalse(draft.receivedEnabled);assertFalse(salesDraftPayload(draft).containsKey("recordedPayments"));assertFalse(salesDraftPayload(draft).toString().contains("Saved ref"))}
    @Test fun duplicationClearsSavedPayments(){assertNull(duplicateSavedSaleDraft(source(),"2026-10-23").recordedPayments)}
    @Test fun cashAndBankReferencesAreIncludedOnlyOnNewSalePayments(){for(mode in listOf("CASH","BANK","CHEQUE")){val draft=SalesEditorDraft(paymentType=mode,paymentReference="Ref 123",receivedEnabled=true,receivedAmount="10");assertEquals("Ref 123",salesDraftPayload(draft)["paymentReference"]!!.jsonPrimitive.content);assertFalse(salesDraftPayload(draft.copy(editingSourceId="saved")).containsKey("paymentReference"))}}

    @Test fun retainedCreditDisplayCannotBeSubmittedAsANewPayment(){
        val doc=buildJsonObject{for((key,value) in source())put(key,value);putJsonObject("paymentSummary"){put("credits","80.00");put("originalReturnCredits","100.00");put("returnCreditsTransferred","20.00");put("received","0.00");put("outstanding","0.00")}}
        val draft=savedSaleEditorDraft(doc)
        assertEquals("100.00",draft.recordedPayments!!.originalReturnCredits)
        assertEquals("20.00",draft.recordedPayments!!.returnCreditsTransferred)
        val payload=salesDraftPayload(draft).toString()
        assertFalse(payload.contains("originalReturnCredits"));assertFalse(payload.contains("returnCreditsTransferred"));assertFalse(payload.contains("recordedPayments"))
    }
}
