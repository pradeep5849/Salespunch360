package com.salespunch360.mobile.account
import com.salespunch360.mobile.ui.account.AccountDisplayPreferences
import org.junit.Assert.*
import org.junit.Test
class AccountDisplayPreferencesTest {
 @Test fun reportDisplayUsesTheSameHalfUpRoundingAsExports(){
  assertTrue(AccountDisplayPreferences("INR",0).money("12.5").contains("13"))
  assertTrue(AccountDisplayPreferences("INR",1).money("1.25").contains("1.3"))
  assertTrue(AccountDisplayPreferences("INR",3).money("-1.2345").contains("1.235"))
 }
 @Test fun currencyAndPrecisionFollowSavedValues(){val p=AccountDisplayPreferences("USD",3);val result=p.money("12.3456");assertTrue(result.contains("12.346"));assertFalse(result.contains("₹"))}
 @Test fun calendarDateFormatsPreserveTheStoredDay(){assertEquals("11/10/2026",AccountDisplayPreferences().date("2026-10-11T00:00:00Z"));assertEquals("10/11/2026",AccountDisplayPreferences(dateFormat="MM/DD/YYYY").date("2026-10-11"));assertEquals("2026-10-11",AccountDisplayPreferences(dateFormat="YYYY-MM-DD").date("2026-10-11"))}
 @Test fun invalidNumericTextRemainsReadable(){assertEquals("Pending",AccountDisplayPreferences().money("Pending"))}
}
