package com.salespunch360.mobile.account
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
fun accountReportToday(clock:Clock=Clock.systemUTC()):LocalDate=LocalDate.now(clock.withZone(ZoneId.of("Asia/Kolkata")))
fun accountReportFinancialYearStart(day:LocalDate=accountReportToday()):LocalDate=LocalDate.of(day.year-(if(day.monthValue<4)1 else 0),4,1)

fun accountReportPeriodBounds(period:String,today:LocalDate=accountReportToday()):Pair<LocalDate,LocalDate> = when(period){
 "TODAY"->today to today
 "THIS_MONTH"->today.withDayOfMonth(1) to today.withDayOfMonth(today.lengthOfMonth())
 "LAST_MONTH"->today.minusMonths(1).withDayOfMonth(1) to today.withDayOfMonth(1).minusDays(1)
 "FINANCIAL_YEAR"->accountReportFinancialYearStart(today).let{it to it.plusYears(1).minusDays(1)}
 else->throw IllegalArgumentException("Unknown report period")
}
