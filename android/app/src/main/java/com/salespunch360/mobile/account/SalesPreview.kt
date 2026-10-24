package com.salespunch360.mobile.account

import java.math.BigDecimal
import java.math.RoundingMode

private fun number(value:String)=if(value.length>30||value.contains('e',true))BigDecimal.ZERO else value.toBigDecimalOrNull()?:BigDecimal.ZERO
private fun entered(line:SalesLineDraft,draft:SalesEditorDraft):BigDecimal {
    val base=(number(line.quantity)*number(line.rate)).setScale(2,RoundingMode.HALF_UP)
    val percent=draft.transactionDiscount.takeIf{it.isNotBlank()}?:line.discountValue.takeIf{line.discountType=="PERCENTAGE"}
    val discount=(if(percent!=null)base.multiply(number(percent)).divide(BigDecimal(100),2,RoundingMode.HALF_UP) else if(line.discountType=="FIXED")number(line.discountValue) else BigDecimal.ZERO).setScale(2,RoundingMode.HALF_UP)
    return (base-discount).max(BigDecimal.ZERO)
}
private fun taxable(line:SalesLineDraft,draft:SalesEditorDraft):BigDecimal {
    val amount=entered(line,draft)
    val tax=number(draft.transactionTaxRate.ifBlank{line.taxRate}).max(BigDecimal.ZERO).min(BigDecimal(100))
    return if(draft.taxMode=="INCLUSIVE")amount.multiply(BigDecimal(100)).divide(BigDecimal(100)+tax+number(line.cessRate).max(BigDecimal.ZERO),2,RoundingMode.HALF_UP) else amount
}
fun salesPreviewTotal(draft:SalesEditorDraft,options:SalesOptions):BigDecimal {
    val total=draft.lines.fold(BigDecimal.ZERO){sum,line->
        val net=taxable(line,draft)
        val gst=net.multiply(number(draft.transactionTaxRate.ifBlank{line.taxRate}).max(BigDecimal.ZERO).min(BigDecimal(100))).divide(BigDecimal(100),2,RoundingMode.HALF_UP)
        val cess=net.multiply(number(line.cessRate).max(BigDecimal.ZERO)).divide(BigDecimal(100),2,RoundingMode.HALF_UP)
        // The document aggregates rounded taxable and tax components, as the server does.
        val gross=net+gst+cess
        sum+if(draft.reverseCharge&&options.transactionPreference("reverseCharge",true))gross-gst-cess else gross
    }.setScale(2,RoundingMode.HALF_UP)+number(draft.freightAmount)+number(draft.otherChargesAmount)+draft.lines.fold(BigDecimal.ZERO){sum,line->sum+taxable(line,draft)}.multiply(number(draft.tcsRate)).divide(BigDecimal(100),2,RoundingMode.HALF_UP)
    if(draft.roundOffAmount.isNotBlank())return (total+number(draft.roundOffAmount)).setScale(2,RoundingMode.HALF_UP)
    val step=number(options.transactionDefaults["transactionPreferences"]?.let{(it as? kotlinx.serialization.json.JsonObject)?.str("roundingStep")}.orEmpty().ifBlank{"1"})
    return if(options.transactionPreference("roundOff")&&step>BigDecimal.ZERO&&step<=BigDecimal(100))total.divide(step,0,RoundingMode.HALF_UP)*step else total
}
fun salesPreviewProfit(draft:SalesEditorDraft,options:SalesOptions):BigDecimal? {
    if(draft.lines.any{line->(line.sourceId.isNotBlank()||line.itemName.isNotBlank())&&options.products.none{it.id==line.sourceId&&it.costPrice!=null}})return null
    return try{draft.lines.fold(BigDecimal.ZERO){sum,line->val master=options.products.firstOrNull{it.id==line.sourceId};sum+taxable(line,draft)-number(master?.costPrice.orEmpty())*primaryUnitQuantity(line.quantity,line.unitSelection,line.secondaryUnitsPerBase.ifBlank{master?.secondaryUnitsPerBase.orEmpty()})}.setScale(2,RoundingMode.HALF_UP)}catch(e:IllegalArgumentException){null}
}

fun salesPreviewAdvance(draft:SalesEditorDraft,options:SalesOptions):BigDecimal {
    if(draft.type!="SALES_INVOICE"||draft.editingSourceId.isNotBlank()||!options.transactionPreference("linkPayments",true))return BigDecimal.ZERO
    val available=options.customerAdvances.filter{it.str("partyId")==draft.customerId&&it.str("branchId")==draft.branchId&&it.str("projectId")==draft.projectId}
        .fold(BigDecimal.ZERO){sum,row->sum+number(row.str("remainingAmount"))}
    return available.max(BigDecimal.ZERO).min(salesPreviewTotal(draft,options).max(BigDecimal.ZERO))
}
