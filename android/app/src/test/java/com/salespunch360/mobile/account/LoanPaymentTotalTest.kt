package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class LoanPaymentTotalTest {
 @Test fun exactPrincipalInterestCharges(){assertEquals("2550.00",loanPaymentTotal("2000","550","0")?.toPlainString());assertEquals("0.31",loanPaymentTotal("0.10","0.20","0.01")?.toPlainString());assertEquals("10000000000000000.00",loanPaymentTotal("9999999999999999.99","0.01")?.toPlainString())}
 @Test fun rejectsInvalidAmounts(){for(value in listOf("-1","1.234","1e5","bad"))assertNull(loanPaymentTotal(value,"0","0"))}
}
