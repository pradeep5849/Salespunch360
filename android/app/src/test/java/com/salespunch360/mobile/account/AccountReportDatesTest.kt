package com.salespunch360.mobile.account
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.*
class AccountReportDatesTest {
 @Test fun usesPreviousAprilFromJanuaryThroughMarch(){assertEquals("2025-04-01",accountReportFinancialYearStart(LocalDate.parse("2026-01-10")).toString());assertEquals("2025-04-01",accountReportFinancialYearStart(LocalDate.parse("2026-03-31")).toString())}
 @Test fun switchesAtBusinessMidnight(){val day=accountReportToday(Clock.fixed(Instant.parse("2026-03-31T18:30:00Z"),ZoneId.of("UTC")));assertEquals("2026-04-01",day.toString());assertEquals("2026-04-01",accountReportFinancialYearStart(day).toString())}
}
