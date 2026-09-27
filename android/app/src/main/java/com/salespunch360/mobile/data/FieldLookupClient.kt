package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

class FieldLookupClient(private val session:SecureSession){
    private val json=Json{ignoreUnknownKeys=true}
    private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS).retryOnConnectionFailure(true).build()
    private fun enc(value:String)=URLEncoder.encode(value,"UTF-8")

    private suspend fun get(path:String):String{
        val token=session.token()
        val request=Request.Builder().url(BuildConfig.API_BASE_URL+path).header("Accept","application/json").apply{token?.let{header("Authorization","Bearer $it")}}.build()
        return http.newCall(request).awaitResponse().use{response->
            val raw=response.body?.string()?:"{}"
            if(!response.isSuccessful){
                if(response.code==401)session.invalidateIfCurrent(token)
                if(response.code==403&&session.token()==token)session.authorizationChanged()
                throw ApiException(response.code,"FIELD_LOOKUP_FAILED")
            }
            raw
        }
    }

    suspend fun customers(q:String="",page:Int=1):FieldContext{
        val params=buildList{
            add("page=${page.coerceAtLeast(1)}")
            if(q.isNotBlank())add("q=${enc(q.take(100))}")
        }.joinToString("&")
        return json.decodeFromString(get("api/v1/mobile/field?$params"))
    }

    suspend fun visitFollowUps(q:String="",page:Int=1):FollowUpsContext{
        val params=buildList{
            add("status=AVAILABLE")
            add("page=${page.coerceAtLeast(1)}")
            if(q.isNotBlank())add("q=${enc(q.take(100))}")
        }.joinToString("&")
        return json.decodeFromString(get("api/v1/mobile/follow-ups?$params"))
    }
}
