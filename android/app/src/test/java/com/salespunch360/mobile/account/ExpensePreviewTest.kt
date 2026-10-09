package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class ExpensePreviewTest {
 @Test fun inclusiveTaxUsesDecimalPrecision(){val p=expensePreview("118",emptyList(),"0","18","0","INCLUSIVE",false)!!;assertEquals("100.00",p.taxable.toPlainString());assertEquals("18.00",p.tax.toPlainString());assertEquals("118.00",p.total.toPlainString())}
 @Test fun billedItemsChargesCessAndRounding(){val p=expensePreview("0",listOf(ExpenseLine("Materials","2.0001","50")),"0.50","18","1","EXCLUSIVE",true)!!;assertEquals("100.51",p.taxable.toPlainString());assertEquals("19.10",p.tax.toPlainString());assertEquals("120",p.total.toPlainString());assertEquals("0.39",p.rounding.toPlainString())}
 @Test fun incomeAndGstOffRemainUntaxed(){val p=expensePreview("10.50",emptyList(),"0","0","0","EXCLUSIVE",false)!!;assertEquals("0.00",p.tax.toPlainString());assertEquals("10.50",p.total.toPlainString())}
 @Test fun invalidAndZeroAmountsHaveNoPreview(){assertNull(expensePreview("0",emptyList(),"0","0","0","EXCLUSIVE",false));assertNull(expensePreview("x",emptyList(),"0","18","0","EXCLUSIVE",false));assertNull(expensePreview("1",emptyList(),"0","101","0","EXCLUSIVE",false))}
 @Test fun largeValuesDoNotLosePaise(){assertEquals("9999999999999999.99",expensePreview("9999999999999999.99",emptyList(),"0","0","0","EXCLUSIVE",false)!!.total.toPlainString())}
}
