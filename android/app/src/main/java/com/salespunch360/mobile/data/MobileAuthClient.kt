package com.salespunch360.mobile.data

import android.content.Context
import com.salespunch360.mobile.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class MobileLoginFailure(val status:Int,val code:String?):Exception(code)

@Serializable
private data class DeviceLoginRequest(
    val identifier:String,
    val password:String,
    val deviceId:String,
    val deviceName:String,
)

class MobileAuthClient(context:Context,private val session:SecureSession){
    private val identity=DeviceIdentity(context)
    private val json=Json{ignoreUnknownKeys=true}
    private val media="application/json".toMediaType()
    private val http=OkHttpClient.Builder()
        .connectTimeout(15,TimeUnit.SECONDS)
        .readTimeout(20,TimeUnit.SECONDS)
        .writeTimeout(20,TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    suspend fun login(identifier:String,password:String):Bootstrap=withContext(Dispatchers.IO){
        val payload=DeviceLoginRequest(identifier,password,identity.id,identity.name)
        val request=Request.Builder()
            .url(BuildConfig.API_BASE_URL+"api/v1/mobile/auth/login")
            .header("Accept","application/json")
            .post(json.encodeToString(payload).toRequestBody(media))
            .build()
        http.newCall(request).execute().use{response->
            val raw=response.body?.string()?:"{}"
            if(!response.isSuccessful){
                val code=runCatching{json.parseToJsonElement(raw).jsonObject["error"]?.jsonPrimitive?.content}.getOrNull()
                throw MobileLoginFailure(response.code,code)
            }
            val login=json.decodeFromString<LoginResponse>(raw)
            session.save(login.accessToken,login.bootstrap.user.id)
            login.bootstrap
        }
    }
}
