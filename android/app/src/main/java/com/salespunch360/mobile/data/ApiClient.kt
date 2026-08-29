package com.salespunch360.mobile.data
import com.salespunch360.mobile.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit
class ApiClient(private val session:SecureSession){private val json=Json{ignoreUnknownKeys=true};private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS).writeTimeout(20,TimeUnit.SECONDS).build();private val media="application/json".toMediaType()
 private suspend fun call(path:String,method:String="GET",body:String?=null,auth:Boolean=true)=withContext(Dispatchers.IO){val b=Request.Builder().url(BuildConfig.API_BASE_URL+path).header("Accept","application/json");if(auth)session.token()?.let{b.header("Authorization","Bearer $it")};if(method=="POST")b.post((body?:"{}").toRequestBody(media));http.newCall(b.build()).execute().use{if(!it.isSuccessful)throw ApiException(it.code);it.body?.string()?:"{}"}}
 suspend fun login(identifier:String,password:String):Bootstrap{val response=json.decodeFromString<LoginResponse>(call("api/v1/mobile/auth/login","POST",json.encodeToString(LoginRequest(identifier,password)),false));session.save(response.accessToken);return response.bootstrap}
 suspend fun bootstrap()=json.decodeFromString<Bootstrap>(call("api/v1/mobile/bootstrap"));suspend fun logout(){runCatching{call("api/v1/mobile/auth/logout","POST")};session.clear()}
 suspend fun attendance(action:String,location:LocationPayload?)=call("api/v1/mobile/attendance","POST",json.encodeToString(AttendanceRequest(action,location)))
 suspend fun upload(point:LocationPayload)=call("api/v1/mobile/locations","POST",json.encodeToString(point))
}
class ApiException(val status:Int):Exception("API request failed")
