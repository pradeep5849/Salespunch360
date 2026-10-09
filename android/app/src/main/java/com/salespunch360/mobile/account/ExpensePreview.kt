package com.salespunch360.mobile.account
import java.math.BigDecimal
import java.math.RoundingMode

data class ExpenseLine(val name:String,val quantity:String,val rate:String)
data class ExpensePreview(val taxable:BigDecimal,val tax:BigDecimal,val rounding:BigDecimal,val total:BigDecimal)
fun expensePreview(amount:String,lines:List<ExpenseLine>,charges:String,gst:String,cess:String,mode:String,round:Boolean,composition:Boolean=false):ExpensePreview? = try {
 fun money(v:BigDecimal)=v.setScale(2,RoundingMode.HALF_UP)
 val base=if(lines.isEmpty())BigDecimal(amount)else lines.fold(BigDecimal.ZERO){sum,l->require(l.name.isNotBlank()&&BigDecimal(l.quantity)>BigDecimal.ZERO);sum+money(BigDecimal(l.quantity)*BigDecimal(l.rate))}
 val entered=base+BigDecimal(charges);require(entered>BigDecimal.ZERO)
 val rate=BigDecimal(gst);val cessRate=BigDecimal(cess);require(rate>=BigDecimal.ZERO&&rate<=BigDecimal(100)&&cessRate>=BigDecimal.ZERO&&cessRate<=BigDecimal(100))
 val taxable=money(if(mode=="INCLUSIVE")(entered*BigDecimal(100)).divide(BigDecimal(100)+rate+cessRate,12,RoundingMode.HALF_UP)else entered)
 val tax=money((taxable*cessRate).divide(BigDecimal(100),12,RoundingMode.HALF_UP))+(if(composition)BigDecimal.ZERO else money((taxable*rate).divide(BigDecimal(100)).setScale(12,RoundingMode.HALF_UP)))
 val gross=money(if(mode=="INCLUSIVE")entered else taxable+tax);val total=if(round)gross.setScale(0,RoundingMode.HALF_UP)else gross
 require(total>BigDecimal.ZERO);ExpensePreview(taxable,tax,total-gross,total)
} catch(_:Exception){null}
