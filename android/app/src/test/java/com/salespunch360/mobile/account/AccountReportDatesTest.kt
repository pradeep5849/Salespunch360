package com.salespunch360.mobile.account
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.*
class AccountReportDatesTest {
 @Test fun usesPreviousAprilFromJanuaryThroughMarch(){assertEquals("2025-04-01",accountReportFinancialYearStart(LocalDate.parse("2026-01-10")).toString());assertEquals("2025-04-01",accountReportFinancialYearStart(LocalDate.parse("2026-03-31")).toString())}
 @Test fun switchesAtBusinessMidnight(){val day=accountReportToday(Clock.fixed(Instant.parse("2026-03-31T18:30:00Z"),ZoneId.of("UTC")));assertEquals("2026-04-01",day.toString());assertEquals("2026-04-01",accountReportFinancialYearStart(day).toString())}
 @Test fun periodPresetsHonorLeapMonthsAndYearRollover(){assertEquals(LocalDate.parse("2024-02-01") to LocalDate.parse("2024-02-29"),accountReportPeriodBounds("THIS_MONTH",LocalDate.parse("2024-02-12")));assertEquals(LocalDate.parse("2025-12-01") to LocalDate.parse("2025-12-31"),accountReportPeriodBounds("LAST_MONTH",LocalDate.parse("2026-01-16")));assertEquals(LocalDate.parse("2025-04-01") to LocalDate.parse("2026-03-31"),accountReportPeriodBounds("FINANCIAL_YEAR",LocalDate.parse("2026-03-16")))}
}
