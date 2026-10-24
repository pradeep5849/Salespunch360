package com.salespunch360.mobile.account
import java.math.BigDecimal
fun loanOpeningNetReceipt(principal:String,fee:String,mode:String):BigDecimal?{
 val gross=loanPaymentTotal(principal)?:return null
 val cost=loanPaymentTotal(fee)?:return null
 if(cost.signum()==0)return gross
 return when(mode){"DEDUCTED"->gross.subtract(cost).takeIf{it.signum()>=0};"SEPARATE"->gross;else->null}
}
