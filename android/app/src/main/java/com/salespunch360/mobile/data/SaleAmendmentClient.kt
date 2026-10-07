package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class SaleAmendmentClient(private val session:SecureSession){
    private val json=Json{ignoreUnknownKeys=true}
    private val media="application/json".toMediaType()
    private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS).writeTimeout(20,TimeUnit.SECONDS).build()
    private fun enc(value:String)=java.net.URLEncoder.encode(value,"UTF-8")
    private suspend fun call(id:String,method:String,payload:JsonObject?=null)=withContext(Dispatchers.IO){
        val token=session.token()
        val body=(payload?.toString()?:"{}").toRequestBody(media)
        val builder=Request.Builder().url(BuildConfig.API_BASE_URL+"api/v1/mobile/account/transactions/${enc(id)}").header("Accept","application/json")
        token?.let{builder.header("Authorization","Bearer $it")}
        when(method){"PATCH"->builder.patch(body);"DELETE"->builder.delete()}
        http.newCall(builder.build()).execute().use{response->
            val raw=response.body?.string()?:"{}"
            if(!response.isSuccessful){if(response.code==401)session.invalidateIfCurrent(token);val code=runCatching{json.parseToJsonElement(raw).jsonObject["error"].toString()}.getOrNull();throw ApiException(response.code,code)}
            raw
        }
    }
    suspend fun replace(id:String,payload:JsonObject)=json.parseToJsonElement(call(id,"PATCH",payload)).jsonObject
    suspend fun delete(id:String){call(id,"DELETE")}
}
