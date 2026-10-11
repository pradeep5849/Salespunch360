package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class AccountReportDataTest {
    @Test fun suppliedReportResponseRetainsPrimitiveNamesColumnsAndArrayRows() {
        val options=Json.parseToJsonElement("""{"reports":["profit-loss","profit-withdrawal"]}""").jsonObject
        assertEquals(listOf("profit-loss","profit-withdrawal"),accountReportNames(options))
        val report=Json.parseToJsonElement("""{"columns":["Owner","Amount"],"rows":[["Owner A","₹ 100.00"],["Owner B",0]]}""").jsonObject
        assertEquals(listOf("Owner","Amount"),accountReportColumns(report))
        assertEquals(listOf(listOf("Owner A","₹ 100.00"),listOf("Owner B","0")),accountReportRows(report))
    }
    @Test fun laterFilterEditsDoNotChangeDisplayedResultsExportRequest() {
        val filters=mutableMapOf("from" to "2026-04-01","to" to "2026-10-11")
        val shown=AppliedAccountReport("profit-withdrawal",filters)
        filters["to"]="2026-12-31"
        assertEquals("2026-10-11",shown.filters["to"])
        assertEquals("profit-withdrawal",shown.report)
    }
}
