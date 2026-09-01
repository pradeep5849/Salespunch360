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
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class ApiClient(private val session:SecureSession){
 private val json=Json{ignoreUnknownKeys=true};private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS).writeTimeout(20,TimeUnit.SECONDS).build();private val media="application/json".toMediaType()
 private suspend fun call(path:String,method:String="GET",body:String?=null,auth:Boolean=true)=withContext(Dispatchers.IO){val builder=Request.Builder().url(BuildConfig.API_BASE_URL+path).header("Accept","application/json");if(auth)session.token()?.let{builder.header("Authorization","Bearer $it")};when(method){"POST"->builder.post((body?:"{}").toRequestBody(media));"PATCH"->builder.patch((body?:"{}").toRequestBody(media))};http.newCall(builder.build()).execute().use{val response=it.body?.string()?:"{}";if(!it.isSuccessful){val code=runCatching{json.parseToJsonElement(response).jsonObject["error"]?.jsonPrimitive?.content}.getOrNull();if(auth&&it.code==401)session.invalidate();throw ApiException(it.code,code)};response}}
 private fun decodeBootstrap(raw:String,path:String=""):Bootstrap{val root=json.parseToJsonElement(raw).jsonObject;val payload=if(path.isEmpty())root else root[path]!!.jsonObject;val role=payload["user"]?.jsonObject?.get("role")?.jsonPrimitive?.content;if(role=="SUPER_ADMIN")throw ForbiddenMobileRoleException();return json.decodeFromJsonElement(Bootstrap.serializer(),payload)}
 suspend fun login(identifier:String,password:String):Bootstrap{val raw=call("api/v1/mobile/auth/login","POST",json.encodeToString(LoginRequest(identifier,password)),false);val root=json.parseToJsonElement(raw).jsonObject;val bootstrap=decodeBootstrap(raw,"bootstrap");session.save(root["accessToken"]!!.jsonPrimitive.content,bootstrap.user.id);return bootstrap}
 suspend fun bootstrap()=decodeBootstrap(call("api/v1/mobile/bootstrap"))
 suspend fun logout(){try{call("api/v1/mobile/auth/logout","POST")}finally{session.clear()}}
 suspend fun changePassword(current:String,password:String,confirm:String)=call("api/v1/mobile/auth/password","POST",json.encodeToString(PasswordChangeRequest(current,password,confirm)))
 suspend fun attendance(action:String,location:LocationPayload?)=call("api/v1/mobile/attendance","POST",json.encodeToString(attendanceRequest(action,location)))
 suspend fun upload(point:LocationPayload)=call("api/v1/mobile/locations","POST",json.encodeToString(point))
 suspend fun employees()=json.decodeFromString<EmployeeContext>(call("api/v1/mobile/employees"))
 suspend fun createEmployee(request:CreateEmployeeRequest)=json.decodeFromString<Employee>(call("api/v1/mobile/employees","POST",json.encodeToString(request)))
 suspend fun setEmployeeActive(employeeId:String,isActive:Boolean)=call("api/v1/mobile/employees","PATCH",json.encodeToString(EmployeeActiveRequest(employeeId,isActive)))
 suspend fun fieldContext()=json.decodeFromString<FieldContext>(call("api/v1/mobile/field"))
 suspend fun checkIn(visitType:String,subjectId:String?,name:String?,phone:String?,location:LocationPayload,notes:String?,photo:ByteArray?)=withContext(Dispatchers.IO){val body=MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart("action","CHECK_IN").addFormDataPart("visitType",visitType).addFormDataPart("latitude",location.latitude.toString()).addFormDataPart("longitude",location.longitude.toString()).addFormDataPart("accuracyMeters",(location.accuracyMeters?:0.0).toString()).apply{notes?.let{addFormDataPart("visitNotes",it)};name?.let{addFormDataPart("name",it)};phone?.let{addFormDataPart("phone",it)};subjectId?.let{addFormDataPart(if(visitType=="CUSTOMER")"customerId" else "leadId",it)};photo?.let{addFormDataPart("photo","photo.webp",it.toRequestBody("image/webp".toMediaType()))}}.build();val request=Request.Builder().url(BuildConfig.API_BASE_URL+"api/v1/mobile/field").header("Accept","application/json").apply{session.token()?.let{header("Authorization","Bearer $it")}}.post(body).build();http.newCall(request).execute().use{val raw=it.body?.string()?="{}";if(!it.isSuccessful){val code=runCatching{json.parseToJsonElement(raw).jsonObject["error"]?.jsonPrimitive?.content}.getOrNull();throw ApiException(it.code,code)};raw}}
 suspend fun checkout(visitId:String,location:LocationPayload,sentiment:VisitSentiment,remarks:String?)=call("api/v1/mobile/field","POST",json.encodeToString(CheckoutRequest(visitId=visitId,location=location,sentiment=sentiment,remarks=remarks)))
 suspend fun leads()=json.decodeFromString<List<LeadSummary>>(call("api/v1/mobile/leads"))
 suspend fun lead(id:String)=json.decodeFromString<LeadSummary>(call("api/v1/mobile/leads?id=$id"))
 suspend fun leadFromVisit(visitId:String,title:String)=json.decodeFromString<LeadSummary>(call("api/v1/mobile/leads","POST",json.encodeToString(LeadFromVisitRequest(visitId=visitId,title=title))))
 suspend fun transitionLead(id:String,version:Int,stage:LeadStage,reason:String?)=call("api/v1/mobile/leads","POST",json.encodeToString(LeadTransitionRequest(leadId=id,version=version,toStage=stage,lostReason=reason)))
 suspend fun updateFollowUp(id:String,at:String?,notes:String?)=call("api/v1/mobile/leads","POST",json.encodeToString(LeadFollowUpRequest(leadId=id,followUpAt=at,notes=notes)))
 suspend fun report(type:String)=json.parseToJsonElement(call("api/v1/mobile/reports?type=$type")).jsonObject
 suspend fun report(type:String,start:String?,end:String?,employeeId:String?):kotlinx.serialization.json.JsonObject {
  fun enc(value:String)=java.net.URLEncoder.encode(value,"UTF-8")
  val parameters=mutableListOf("type=${enc(type)}")
  start?.let { parameters += "start=${enc(it)}" }
  end?.let { parameters += "end=${enc(it)}" }
  employeeId?.let { parameters += "employeeId=${enc(it)}" }
  return json.parseToJsonElement(call("api/v1/mobile/reports?${parameters.joinToString("&")}")).jsonObject
 }
 suspend fun company()=json.decodeFromString<CompanyContext>(call("api/v1/mobile/company"))
 suspend fun updateOperations(data:OperationsSettings)=json.decodeFromString<CompanyContext>(call("api/v1/mobile/company","PATCH",json.encodeToString(CompanyUpdateRequest("operations",data))))
 suspend fun updateGeofence(data:GeofenceSettings)=json.decodeFromString<CompanyContext>(call("api/v1/mobile/company","PATCH",json.encodeToString(CompanyUpdateRequest("geofence",data))))
 suspend fun targets()=json.decodeFromString<TargetsContext>(call("api/v1/mobile/targets"))
 suspend fun createTarget(data:TargetRequest)=json.decodeFromString<TargetsContext>(call("api/v1/mobile/targets","POST",json.encodeToString(data)))
 suspend fun editTarget(data:EditTargetRequest)=json.decodeFromString<TargetsContext>(call("api/v1/mobile/targets","PATCH",json.encodeToString(data)))
}
class ApiException(val status:Int,val code:String?=null):Exception("API request failed")
class ForbiddenMobileRoleException:Exception("Mobile role is not allowed")
