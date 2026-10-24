package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class LoanOpeningFeeTest{
 @Test fun deductedFeeReducesOnlyReceipt(){assertEquals("98000.00",loanOpeningNetReceipt("100000","2000","DEDUCTED").toString());assertEquals("100000.00",loanOpeningNetReceipt("100000","2000","SEPARATE").toString())}
 @Test fun modeIsRequiredOnlyForPositiveFee(){assertEquals("100.00",loanOpeningNetReceipt("100","0","").toString());assertNull(loanOpeningNetReceipt("100","1",""));assertNull(loanOpeningNetReceipt("100","101","DEDUCTED"));assertEquals("0.00",loanOpeningNetReceipt("100","100","DEDUCTED").toString())}
 @Test fun invalidOrOverpreciseAmountsNeverSilentlyRound(){for(value in listOf("-1","oops","1.001"))assertNull(loanOpeningNetReceipt("100",value,"SEPARATE"))}
}
