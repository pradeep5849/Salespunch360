package com.salespunch360.mobile.account

import kotlinx.serialization.json.*

internal fun chequeActionPayload(row:JsonObject,action:String,date:String,reason:String,requestKey:String,moneyAccountId:String?,description:String)=buildJsonObject {
    put("action",action);put("actionDate",date);put("requestKey",requestKey)
    put("expectedVersion",row["actionVersion"]?.jsonPrimitive?.intOrNull?:0)
    if(action=="CLOSE"){
        put("moneyAccountId",moneyAccountId ?: row.str("moneyAccountId"));put("description",description.trim())
    }else put("reason",reason.trim())
}
