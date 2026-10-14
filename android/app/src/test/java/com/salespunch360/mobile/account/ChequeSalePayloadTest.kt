package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ChequeSalePayloadTest {
    @Test fun chequeDetailsReachTheInvoicePaymentBoundary() {
        val payload=salesDraftPayload(SalesEditorDraft(paymentType="CHEQUE",chequeNumber=" 1234 ",chequeDate="2026-10-10",paymentReference="Paper reference",receivedEnabled=true,receivedAmount="1593.00"))
        assertEquals("CHEQUE",payload["paymentType"]?.jsonPrimitive?.content)
        assertEquals("1234",payload["chequeNumber"]?.jsonPrimitive?.content)
        assertEquals("2026-10-10",payload["chequeDate"]?.jsonPrimitive?.content)
        assertEquals("1593.00",payload["receivedAmount"]?.jsonPrimitive?.content)
    }
    @Test fun ordinaryPaymentsAndPostedEditsDoNotSubmitChequeInstructions() {
        assertFalse(salesDraftPayload(SalesEditorDraft(paymentType="CASH",chequeNumber="1234")).containsKey("chequeNumber"))
        val edited=salesDraftPayload(SalesEditorDraft(paymentType="CHEQUE",chequeNumber="1234",editingSourceId="saved-sale"))
        assertFalse(edited.containsKey("chequeNumber"));assertFalse(edited.containsKey("receivedAmount"))
    }
}
