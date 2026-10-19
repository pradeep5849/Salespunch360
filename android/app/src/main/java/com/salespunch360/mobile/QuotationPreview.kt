package com.salespunch360.mobile

import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.serialization.json.*

data class QuotationPreview(val subtotal:String,val discount:String,val charges:String,val taxable:String,val tax:String,val total:String,val roundOff:String="0.00")

/** Read-only preview using the shared tax rounding policy; authoritative validation and saving stay on the server. */
fun quotationPreview(draft:QuotationDraft):QuotationPreview? = try {
    require(draft.taxMode=="EXCLUSIVE"||draft.taxMode=="INCLUSIVE")
    val zero=BigDecimal.ZERO
    val hundred=BigDecimal(100)
    fun split(amount:BigDecimal,rate:BigDecimal):Pair<BigDecimal,BigDecimal>{val net=if(draft.taxMode=="INCLUSIVE")amount.multiply(hundred).divide(hundred+rate,2,RoundingMode.HALF_UP)else amount;return net to net.multiply(rate).divide(hundred,2,RoundingMode.HALF_UP)}
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
    var discountTotal=sum(discounts);var remaining=sum(net);var charges=zero;var adjustmentTax=zero;var chargeTaxable=zero
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
        if(type=="ADDITIONAL_CHARGE"){val amounts=split(value,if((row["taxable"] as? JsonPrimitive)?.booleanOrNull==true)taxRate else zero);chargeTaxable=money(chargeTaxable+amounts.first);adjustmentTax=money(adjustmentTax+amounts.second)}
    }
    val amounts=net.indices.map{split(net[it],taxes[it])}
    val taxable=money(sum(amounts.map{it.first})+chargeTaxable)
    val tax=money(sum(amounts.map{it.second})+adjustmentTax)
    val rawTotal=money(taxable+tax)
    val roundOff=if(draft.roundOffEnabled)money(rawTotal.setScale(0,RoundingMode.HALF_UP)-rawTotal)else money(zero)
    QuotationPreview(sum(bases).toPlainString(),money(discountTotal).toPlainString(),money(charges).toPlainString(),taxable.toPlainString(),tax.toPlainString(),money(rawTotal+roundOff).toPlainString(),roundOff.toPlainString())
}catch(_:IllegalArgumentException){null}catch(_:ArithmeticException){null}
