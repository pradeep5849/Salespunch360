package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class DeviceAdminFailure(val status:Int,val code:String?):Exception(code)

class DeviceAdminClient(private val session:SecureSession){
    private val json=Json{ignoreUnknownKeys=true}
    private val media="application/json".toMediaType()
    private val http=OkHttpClient.Builder()
        .connectTimeout(15,TimeUnit.SECONDS)
        .readTimeout(20,TimeUnit.SECONDS)
        .writeTimeout(20,TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    suspend fun reset(employeeId:String)=withContext(Dispatchers.IO){
        val token=session.token()?:throw IOException("No session")
        val body=buildJsonObject{put("action","RESET_DEVICE");put("employeeId",employeeId)}.toString()
        val request=Request.Builder()
            .url(BuildConfig.API_BASE_URL+"api/v1/mobile/employees")
            .header("Accept","application/json")
            .header("Authorization","Bearer $token")
            .patch(body.toRequestBody(media))
            .build()
        http.newCall(request).execute().use{response->
            val raw=response.body?.string()?:"{}"
            if(!response.isSuccessful){
                val code=runCatching{json.parseToJsonElement(raw).jsonObject["error"]?.jsonPrimitive?.content}.getOrNull()
                if(response.code==401)session.invalidateIfCurrent(token)
                throw DeviceAdminFailure(response.code,code)
            }
        }
    }
}
