package com.salespunch360.mobile.account

import java.math.BigDecimal
import kotlinx.serialization.json.*

data class SavedSaleReceipt(val amount:String,val date:String,val mode:String,val reference:String)
data class SavedSalePayments(val received:String,val discount:String,val advance:String,val outstanding:String,val receipts:List<SavedSaleReceipt>)
/** Read-only saved invoice display; never added to a payment or invoice write payload. */
fun savedSalePayments(doc:JsonObject):SavedSalePayments {
    val totals=saleDetailTotals(doc)
    val receipts=doc.array("allocations").mapNotNull { row ->
        val settlement=row["settlement"] as? JsonObject ?: return@mapNotNull null
        if(settlement.str("type")!="CUSTOMER_RECEIPT" || settlement.str("status") in listOf("PENDING_CHEQUE","REVERSED"))return@mapNotNull null
        val amount=row.str("amount").toBigDecimalOrNull() ?: return@mapNotNull null
        val discount=row.str("discountAmount").toBigDecimalOrNull() ?: BigDecimal.ZERO
        SavedSaleReceipt((amount-discount).toPlainString(),settlement.str("transactionDate").take(10),settlement.str("paymentMode"),settlement.str("reference"))
    }
    return SavedSalePayments(totals.received,totals.discount,totals.advance,totals.outstanding,receipts)
}
