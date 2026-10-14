package com.salespunch360.mobile.account
import java.math.BigDecimal
fun loanPaymentTotal(vararg values:String):BigDecimal? {
 var total=BigDecimal.ZERO
 for(raw in values){val value=raw.trim().ifBlank{"0"};if(!Regex("^\\d{1,16}(\\.\\d{1,2})?$").matches(value))return null;total=total.add(BigDecimal(value))}
 return total.setScale(2)
}
