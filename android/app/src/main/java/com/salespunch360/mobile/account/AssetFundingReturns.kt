package com.salespunch360.mobile.account

import java.math.BigDecimal
import kotlinx.serialization.json.*

/** Build explicit repayment attribution; never infer an asset from a cash payment. */
fun assetFundingReturns(options:List<JsonElement>, values:Map<String,String>, ownerId:String, branchId:String, payment:String):JsonArray? {
    val total=payment.toBigDecimalOrNull()?.takeIf { it.signum()>0 && it.stripTrailingZeros().scale()<=2 } ?: return null
    val scoped=options.map { it.jsonObject }.filter { it["ownerFinancialAccountId"]?.jsonPrimitive?.content==ownerId && it["branchId"]?.jsonPrimitive?.content==branchId }.associateBy { it["id"]!!.jsonPrimitive.content }
    var used=BigDecimal.ZERO
    val result=mutableListOf<JsonElement>()
    for((id,text) in values.toSortedMap()) {
        if(text.isBlank()) continue
        val row=scoped[id] ?: return null
        val amount=text.toBigDecimalOrNull()?.takeIf { it.signum()>0 && it.stripTrailingZeros().scale()<=2 } ?: return null
        val outstanding=row["remainingAmount"]?.jsonPrimitive?.content?.toBigDecimalOrNull() ?: return null
        if(amount>outstanding) return null
        used=used.add(amount)
        result.add(buildJsonObject { put("fundingId",id);put("amount",amount.toPlainString()) })
    }
    return if(used<=total)JsonArray(result)else null
}
