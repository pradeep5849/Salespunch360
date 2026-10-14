package com.salespunch360.mobile.account
import org.junit.Assert.assertEquals
import org.junit.Test
class ProjectReportFieldTest {
    @Test fun monetaryReportColumnsUseCurrency() {
        listOf("amount","cost","taxableAmount","taxAmount","totalAmount","remainingAmount","revenue","tax","total","outstanding").forEach {
            assertEquals(ProjectReportFieldType.MONEY,projectReportFieldType(it))
        }
    }
    @Test fun calendarDateUsesSavedDateFormat() { assertEquals(ProjectReportFieldType.DATE,projectReportFieldType("date")) }
    @Test fun quantitiesPercentagesAndIdentifiersRemainUnchanged() {
        listOf("quantity","id","sourceProjectId","destinationProjectId","reversalOfId","number","reference","status","actualMarginPercent","unknown").forEach {
            assertEquals(ProjectReportFieldType.TEXT,projectReportFieldType(it))
        }
    }
}
