package com.salespunch360.mobile.account

import java.math.BigDecimal
import java.math.RoundingMode

data class ItemMasterPrice(val rate:String,val discountType:String="",val discountValue:String="0")
fun itemMasterPrice(master:SalesOption?,taxMode:String,purchase:Boolean=false,discounts:Boolean=true,quantity:String="1"):ItemMasterPrice {
    val rate=master?.rate.orEmpty()
    val p=master?.pricing?:return ItemMasterPrice(rate)
    if(p.str("enteredSalePrice").isBlank())return ItemMasterPrice(rate)
    val base=rate.toBigDecimalOrNull()?:BigDecimal.ZERO
    val tax=master.taxRate?.toBigDecimalOrNull()?:BigDecimal.ZERO
    val factor=if(taxMode=="INCLUSIVE")BigDecimal.ONE+tax.divide(BigDecimal(100)) else BigDecimal.ONE
    val type=if(discounts&&!purchase)p.str("discountType").takeIf{it in listOf("PERCENTAGE","FIXED")}.orEmpty()else ""
    val original=p.str("discountValue").toBigDecimalOrNull()
    val fixedBase=if(original!=null){if(p.str("saleTaxMode")=="INCLUSIVE")original.multiply(BigDecimal(100)).divide(BigDecimal(100)+tax,12,RoundingMode.HALF_UP)else original}else p.str("normalizedDiscountValue").toBigDecimalOrNull()?:BigDecimal.ZERO
    val discount=when(type){"FIXED"->fixedBase.multiply(factor).multiply(quantity.toBigDecimalOrNull()?:BigDecimal.ZERO);"PERCENTAGE"->p.str("normalizedDiscountValue").toBigDecimalOrNull()?:BigDecimal.ZERO;else->BigDecimal.ZERO}
    val entered=p.str(if(purchase)"enteredPurchasePrice"else "enteredSalePrice").toBigDecimalOrNull()
    val shown=if(taxMode=="INCLUSIVE"&&p.str(if(purchase)"purchaseTaxMode"else "saleTaxMode")=="INCLUSIVE"&&entered!=null)entered else base.multiply(factor)
    return ItemMasterPrice(shown.setScale(2,RoundingMode.HALF_UP).toPlainString(),type,(if(type=="FIXED")discount.setScale(2,RoundingMode.HALF_UP)else discount).stripTrailingZeros().toPlainString())
}
