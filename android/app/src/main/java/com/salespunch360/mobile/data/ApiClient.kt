package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ApiClient(private val session:SecureSession){
 private val json=Json{ignoreUnknownKeys=true};private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS).writeTimeout(20,TimeUnit.SECONDS).build();private val media="application/json".toMediaType()
 private suspend fun call(path:String,method:String="GET",body:String?=null,auth:Boolean=true)=withContext(Dispatchers.IO){val builder=Request.Builder().url(BuildConfig.API_BASE_URL+path).header("Accept","application/json");if(auth)session.token()?.let{builder.header("Authorization","Bearer $it")};if(method=="POST")builder.post((body?:"{}").toRequestBody(media));http.newCall(builder.build()).execute().use{if(!it.isSuccessful)throw ApiException(it.code);it.body?.string()?:"{}"}}
 private fun decodeBootstrap(raw:String,path:String=""):Bootstrap{val root=json.parseToJsonElement(raw).jsonObject;val payload=if(path.isEmpty())root else root[path]!!.jsonObject;val role=payload["user"]?.jsonObject?.get("role")?.jsonPrimitive?.content;if(role=="SUPER_ADMIN")throw ForbiddenMobileRoleException();return json.decodeFromJsonElement(Bootstrap.serializer(),payload)}
 suspend fun login(identifier:String,password:String):Bootstrap{val raw=call("api/v1/mobile/auth/login","POST",json.encodeToString(LoginRequest(identifier,password)),false);val root=json.parseToJsonElement(raw).jsonObject;val bootstrap=decodeBootstrap(raw,"bootstrap");session.save(root["accessToken"]!!.jsonPrimitive.content);return bootstrap}
 suspend fun bootstrap()=decodeBootstrap(call("api/v1/mobile/bootstrap"))
 suspend fun logout(){try{call("api/v1/mobile/auth/logout","POST")}finally{session.clear()}}
 suspend fun attendance(action:String,location:LocationPayload?)=call("api/v1/mobile/attendance","POST",json.encodeToString(AttendanceRequest(action,location)))
 suspend fun upload(point:LocationPayload)=call("api/v1/mobile/locations","POST",json.encodeToString(point))
}
class ApiException(val status:Int):Exception("API request failed")
class ForbiddenMobileRoleException:Exception("Mobile role is not allowed")
