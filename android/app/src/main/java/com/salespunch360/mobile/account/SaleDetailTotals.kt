package com.salespunch360.mobile.account

import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.serialization.json.*

internal data class SaleDetailTotals(val received:String,val discount:String,val advance:String,val credits:String,val outstanding:String,val lifecycle:String,val canChange:Boolean)
internal fun saleDetailTotals(doc:JsonObject):SaleDetailTotals {
    val summary=doc["paymentSummary"] as? JsonObject
    if(summary!=null)return SaleDetailTotals(summary.str("received"),summary.str("paymentDiscount"),summary.str("advanceApplied"),summary.str("credits"),summary.str("outstanding"),summary.str("lifecycle"),summary.bool("canChange"))
    fun money(value:String)=value.toBigDecimalOrNull() ?: BigDecimal.ZERO
    fun text(value:BigDecimal)=value.setScale(2,RoundingMode.HALF_UP).toPlainString()
    val receipts=doc.array("allocations").map{it.jsonObject}.filter{row->(row["settlement"] as? JsonObject)?.let{it.str("type")=="CUSTOMER_RECEIPT"&&it.str("status") !in listOf("PENDING_CHEQUE","REVERSED")}==true}
    val received=receipts.fold(BigDecimal.ZERO){sum,row->sum+money(row.str("amount"))-money(row.str("discountAmount"))}
    val discount=receipts.fold(BigDecimal.ZERO){sum,row->sum+money(row.str("discountAmount"))}
    val advance=doc.array("advanceApplications").map{it.jsonObject}.filter{row->(row["advance"] as? JsonObject)?.str("status") !in listOf("PENDING_CHEQUE","REVERSED")}.fold(BigDecimal.ZERO){sum,row->sum+money(row.str("amount"))}
    val credits=doc.array("adjustments").map{it.jsonObject}.filter{it.str("type")=="CREDIT_NOTE"&&it.str("status")=="POSTED"}.fold(BigDecimal.ZERO){sum,row->sum+money(row.str("payableAmount").ifBlank{row.str("grandTotal")})}
    val active=doc.str("status")=="POSTED"
    val outstanding=if(active)(doc["financial"] as? JsonObject)?.str("outstanding").orEmpty().ifBlank{doc.str("payableAmount").ifBlank{doc.str("grandTotal")}} else "0.00"
    return SaleDetailTotals(text(received),text(discount),text(advance),text(credits),outstanding,doc.str("status"),false)
}
