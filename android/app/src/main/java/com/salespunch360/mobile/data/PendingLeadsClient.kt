package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

@Serializable
data class PendingLeadsPageResponse(
    val count:Int=0,
    val page:Int=1,
    val pageSize:Int=50,
    val hasMore:Boolean=false,
    val visits:List<PendingLeadVisit> = emptyList(),
)

class PendingLeadsClient(private val session:SecureSession){
    private val json=Json{ignoreUnknownKeys=true}
    private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS).retryOnConnectionFailure(true).build()
    private fun enc(value:String)=URLEncoder.encode(value,"UTF-8")
    suspend fun page(page:Int=1,q:String="",employeeId:String?=null):PendingLeadsPageResponse{
        val token=session.token()
        val params=buildList{
            add("view=pending")
            add("page=$page")
            add("pageSize=50")
            if(q.isNotBlank())add("q=${enc(q.take(100))}")
            employeeId?.takeIf{it.isNotBlank()}?.let{add("employeeId=${enc(it)}")}
        }.joinToString("&")
        val request=Request.Builder().url(BuildConfig.API_BASE_URL+"api/v1/mobile/leads?$params").header("Accept","application/json").apply{token?.let{header("Authorization","Bearer $it")}}.build()
        return http.newCall(request).awaitResponse().use{response->
            val raw=response.body?.string()?:"{}"
            if(!response.isSuccessful){if(response.code==401)session.invalidateIfCurrent(token);if(response.code==403)session.authorizationChanged();throw ApiException(response.code,"PENDING_LEADS_FAILED")}
            json.decodeFromString(raw)
        }
    }
}
