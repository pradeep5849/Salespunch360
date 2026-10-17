package com.salespunch360.mobile.data

data class AccountMasterWriteRequest(val path:String,val method:String)
/** Editors represent an unsaved record with an empty id. It must use the collection POST. */
fun accountMasterWriteRequest(kind:String,id:String?):AccountMasterWriteRequest {
    fun enc(value:String)=java.net.URLEncoder.encode(value,"UTF-8")
    val savedId=id?.takeIf{it.isNotBlank()}
    return AccountMasterWriteRequest("api/v1/mobile/account/master-data/${enc(kind)}${savedId?.let{"/${enc(it)}"}.orEmpty()}",if(savedId==null)"POST" else "PATCH")
}
