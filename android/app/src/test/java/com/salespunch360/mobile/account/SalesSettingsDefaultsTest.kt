package com.salespunch360.mobile.account

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.*
import org.junit.Test

class SalesSettingsDefaultsTest {
    @Test fun defaultsApplyToNewSaleAndRespectTermsSwitch() {
        val options=SalesOptions(transactionDefaults=Json.parseToJsonElement("""{"defaultDueDays":15,"salesTerms":"Sale terms","projectTerms":"Project terms","transactionPreferences":{"cashSaleByDefault":true,"transactionTime":true}}""").jsonObject)
        val draft=options.defaultSalesDraft("SALES_INVOICE","branch")
        assertEquals("Sale terms",draft.notes)
        assertEquals(java.time.LocalDate.parse(draft.issueDate).plusDays(15).toString(),draft.dueDate)
        assertTrue(draft.receivedInFull)
        assertTrue(draft.transactionTime.matches(Regex("[0-2][0-9]:[0-5][0-9]")))
        assertEquals("Project terms",options.defaultSalesDraft("SALES_INVOICE","branch",true).notes)
        val disabled=SalesOptions(transactionDefaults=Json.parseToJsonElement("""{"salesTerms":"Hidden terms","transactionPreferences":{"termsEnabled":false}}""").jsonObject)
        assertEquals("",disabled.defaultSalesDraft("SALES_INVOICE","branch").notes)
        assertFalse(disabled.defaultSalesDraft("SALES_INVOICE","branch").receivedInFull)
    }
}
