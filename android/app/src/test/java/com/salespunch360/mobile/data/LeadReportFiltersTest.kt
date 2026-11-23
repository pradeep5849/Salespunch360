package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class LeadReportFiltersTest{
 @Test fun filtersEncodeTheSameSubsetForPagingAndExport(){assertEquals(listOf("stage=WON","source=PHONE","followUp=OVERDUE","q=A%26B+%2B+sales"),LeadReportFilters("WON","PHONE","OVERDUE"," A&B + sales ").parameters("leads"))}
 @Test fun defaultsDoNotFilterAndOtherReportsDoNotReceiveLeadFields(){assertTrue(LeadReportFilters().parameters("leads").isEmpty());assertTrue(LeadReportFilters("WON").parameters("attendance").isEmpty())}
}
