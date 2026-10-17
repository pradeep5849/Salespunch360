package com.salespunch360.mobile

import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.serialization.json.*

data class QuotationPreview(val subtotal:String,val discount:String,val charges:String,val taxable:String,val tax:String,val total:String)

/** Read-only exclusive-tax preview; authoritative validation and saving stay on the server. */
fun quotationPreview(draft:QuotationDraft):QuotationPreview? = try {
    val zero=BigDecimal.ZERO
    val hundred=BigDecimal(100)
    fun money(value:BigDecimal)=value.setScale(2,RoundingMode.HALF_UP)
    fun sum(values:List<BigDecimal>)=money(values.fold(zero,BigDecimal::add))
    fun percent(value:BigDecimal):BigDecimal { require(value>=zero&&value<=hundred);return value }
    fun amount(base:BigDecimal,type:String,raw:String):BigDecimal {
        val value=raw.toBigDecimal();require(value>=zero&&value<=BigDecimal("9999999999999999.99"))
        require(type=="FIXED"||type=="PERCENTAGE")
        return money(if(type=="PERCENTAGE")base.multiply(percent(value)).divide(hundred)else value)
    }
    require(draft.lines.isNotEmpty())
    val bases=mutableListOf<BigDecimal>();val taxes=mutableListOf<BigDecimal>();val net=mutableListOf<BigDecimal>();val discounts=mutableListOf<BigDecimal>()
    draft.lines.forEach { line ->
        val quantity=line.quantity.toBigDecimal();val rate=line.rate.toBigDecimal()
        // A blank master tax rate is resolved by the server; never guess it here.
        val tax=percent((if(line.taxRate.isBlank()&&line.lineType=="CUSTOM")"0"else line.taxRate).toBigDecimal())
        require(quantity>zero&&rate>=zero)
        val base=money(quantity.multiply(rate));val discount=if(line.discountType.isBlank())zero else amount(base,line.discountType,line.discountValue)
        require(discount<=base);bases+=base;discounts+=discount;net+=money(base-discount);taxes+=tax
    }
    var discountTotal=sum(discounts);var remaining=sum(net);var charges=zero;var adjustmentTax=zero
    draft.adjustments.forEach { row ->
        fun text(key:String)=(row[key] as? JsonPrimitive)?.contentOrNull.orEmpty()
        val type=text("type");require(type=="DISCOUNT"||type=="ADDITIONAL_CHARGE")
        val value=amount(if(type=="DISCOUNT")remaining else remaining+charges,text("valueType"),text("value"))
        if(type=="DISCOUNT"){
            require(value<=remaining)
            val base=sum(net);var allocated=zero;val last=net.indexOfLast { it>zero }
            net.indices.forEach { index ->
                if(net[index]>zero){
                    val share=if(index==last)money(value-allocated)else money(value.multiply(net[index]).divide(base,48,RoundingMode.HALF_UP))
                    allocated=money(allocated+share);net[index]=money(net[index]-share)
                }
            }
            discountTotal=money(discountTotal+value);remaining=money(remaining-value)
        }else charges=money(charges+value)
        val taxRate=percent(text("taxRate").ifBlank{"0"}.toBigDecimal())
        if(type=="ADDITIONAL_CHARGE"&&(row["taxable"] as? JsonPrimitive)?.booleanOrNull==true)adjustmentTax=money(adjustmentTax+money(value.multiply(taxRate).divide(hundred)))
    }
    val taxable=money(remaining+charges)
    val tax=money(sum(net.indices.map { money(net[it].multiply(taxes[it]).divide(hundred)) })+adjustmentTax)
    QuotationPreview(sum(bases).toPlainString(),money(discountTotal).toPlainString(),money(charges).toPlainString(),taxable.toPlainString(),tax.toPlainString(),money(taxable+tax).toPlainString())
}catch(_:IllegalArgumentException){null}catch(_:ArithmeticException){null}
