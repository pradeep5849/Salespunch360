package com.salespunch360.mobile.account
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
fun accountReportToday(clock:Clock=Clock.systemUTC()):LocalDate=LocalDate.now(clock.withZone(ZoneId.of("Asia/Kolkata")))
fun accountReportFinancialYearStart(day:LocalDate=accountReportToday()):LocalDate=LocalDate.of(day.year-(if(day.monthValue<4)1 else 0),4,1)
