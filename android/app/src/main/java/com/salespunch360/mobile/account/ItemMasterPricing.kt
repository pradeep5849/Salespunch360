package com.salespunch360.mobile.account

import java.math.BigDecimal
import java.math.RoundingMode

data class ItemMasterPrice(val rate:String,val discountType:String="",val discountValue:String="0")
fun itemMasterPrice(master:SalesOption?,taxMode:String,purchase:Boolean=false,discounts:Boolean=true,quantity:String="1",priceKind:String="RETAIL",customerRate:String?=null,wholesaleRate:String?=null):ItemMasterPrice {
    val rate=master?.rate.orEmpty()
    val customer=!purchase&&priceKind=="CUSTOMER"
    require(!customer||customerRate?.toBigDecimalOrNull()?.signum()?.let{it>=0}==true){"CUSTOMER_PRICE_UNAVAILABLE"}
    val wholesale=!purchase&&priceKind=="WHOLESALE"
    val catalogueWholesale=wholesale&&wholesaleRate!=null
    require(wholesaleRate==null||wholesaleRate.toBigDecimalOrNull()?.signum()?.let{it>=0}==true){"WHOLESALE_PRICE_UNAVAILABLE"}
    val p=master?.pricing
    if(p==null||p.str("enteredSalePrice").isBlank()){
        if(!customer&&!catalogueWholesale)return ItemMasterPrice(rate)
        val factor=if(taxMode=="INCLUSIVE")BigDecimal.ONE+(master?.taxRate?.toBigDecimalOrNull()?:BigDecimal.ZERO).divide(BigDecimal(100)) else BigDecimal.ONE
        return ItemMasterPrice((if(customer)customerRate!! else wholesaleRate!!).toBigDecimal().multiply(factor).setScale(2,RoundingMode.HALF_UP).toPlainString())
    }
    require(!wholesale||catalogueWholesale||p.str("normalizedWholesalePrice").toBigDecimalOrNull()!=null){"WHOLESALE_PRICE_UNAVAILABLE"}
    val base=(if(customer)customerRate else if(wholesale)(wholesaleRate?:p.str("normalizedWholesalePrice"))else rate)?.toBigDecimalOrNull()?:BigDecimal.ZERO
    val tax=master.taxRate?.toBigDecimalOrNull()?:BigDecimal.ZERO
    val factor=if(taxMode=="INCLUSIVE")BigDecimal.ONE+tax.divide(BigDecimal(100)) else BigDecimal.ONE
    val type=if(discounts&&!purchase)p.str("discountType").takeIf{it in listOf("PERCENTAGE","FIXED")}.orEmpty()else ""
    val original=p.str("discountValue").toBigDecimalOrNull()
    val fixedBase=if(original!=null){if(p.str("saleTaxMode")=="INCLUSIVE")original.multiply(BigDecimal(100)).divide(BigDecimal(100)+tax,12,RoundingMode.HALF_UP)else original}else p.str("normalizedDiscountValue").toBigDecimalOrNull()?:BigDecimal.ZERO
    val discount=when(type){"FIXED"->fixedBase.multiply(factor).multiply(quantity.toBigDecimalOrNull()?:BigDecimal.ZERO);"PERCENTAGE"->p.str("normalizedDiscountValue").toBigDecimalOrNull()?:BigDecimal.ZERO;else->BigDecimal.ZERO}
    val entered=p.str(if(purchase)"enteredPurchasePrice"else if(wholesale)"wholesalePrice"else "enteredSalePrice").toBigDecimalOrNull()
    val shown=if(!customer&&!catalogueWholesale&&taxMode=="INCLUSIVE"&&p.str(if(purchase)"purchaseTaxMode"else "saleTaxMode")=="INCLUSIVE"&&entered!=null)entered else base.multiply(factor)
    return ItemMasterPrice(shown.setScale(2,RoundingMode.HALF_UP).toPlainString(),type,(if(type=="FIXED")discount.setScale(2,RoundingMode.HALF_UP)else discount).stripTrailingZeros().toPlainString())
}


/** Prices and saved per-unit discounts use primary stock quantities. */
fun primaryUnitQuantity(quantity:String,selection:String="PRIMARY",conversion:String=""):BigDecimal{
 val entered=quantity.toBigDecimalOrNull()?:throw IllegalArgumentException("Invalid quantity")
 require(entered.signum()>=0&&entered.stripTrailingZeros().scale()<=4&&entered<BigDecimal("100000000000000")){"Invalid quantity"}
 require(selection in listOf("PRIMARY","SECONDARY")){"Invalid unit"}
 val base=if(selection=="SECONDARY"){
  require(validUnitConversionRate(conversion)){"Unit conversion unavailable"}
  try{entered.divide(conversion.toBigDecimal(),4,RoundingMode.UNNECESSARY)}catch(e:ArithmeticException){throw IllegalArgumentException("Quantity does not convert exactly")}
 }else entered
 require(base<BigDecimal("100000000000000")){"Converted quantity exceeds limit"}
 return base
}
fun itemMasterPriceForUnit(master:SalesOption?,taxMode:String,purchase:Boolean=false,discounts:Boolean=true,quantity:String="1",priceKind:String="RETAIL",customerRate:String?=null,wholesaleRate:String?=null,selection:String="PRIMARY",conversion:String=master?.secondaryUnitsPerBase.orEmpty()):ItemMasterPrice{
 val base=primaryUnitQuantity(quantity,selection,conversion)
 val price=itemMasterPrice(master,taxMode,purchase,discounts,base.toPlainString(),priceKind,customerRate,wholesaleRate)
 return if(selection=="SECONDARY")price.copy(rate=price.rate.toBigDecimal().divide(conversion.toBigDecimal(),2,RoundingMode.HALF_UP).toPlainString()) else price
}

/** Explicit new-line unit selection uses only the item's assigned units. */
fun salesUnitLine(line:SalesLineDraft,master:SalesOption,taxMode:String,selection:String,discounts:Boolean=true,unit:SalesOption?=null):SalesLineDraft {
 require(line.sourceCommercialLineId.isBlank()&&line.originalLineId.isBlank()&&line.copiedFromSaleLineId.isBlank()){ "Original line unit is retained" }
 require(selection!="SECONDARY"||master.secondaryUnitId.isNotBlank()){ "Unit conversion unavailable" }
 val price=itemMasterPriceForUnit(master,taxMode,discounts=discounts,quantity=line.quantity,selection=selection)
 return line.copy(unitSelection=selection,secondaryUnitsPerBase=master.secondaryUnitsPerBase,rate=price.rate,discountType=price.discountType,discountValue=price.discountValue,unitName=unit?.name.orEmpty(),unitSymbol=unit?.symbol.orEmpty())
}
