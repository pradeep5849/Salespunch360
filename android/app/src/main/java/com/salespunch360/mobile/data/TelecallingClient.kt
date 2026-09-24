package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.net.URLEncoder
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

class TelecallingClient(private val session: SecureSession) {
    companion object {
        private val http = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).writeTimeout(20, TimeUnit.SECONDS).retryOnConnectionFailure(true).build()
    }
    private val json = Json { ignoreUnknownKeys = true }
    private val media = "application/json".toMediaType()
    private fun enc(value: String) = URLEncoder.encode(value, "UTF-8")
    private suspend fun call(path: String, method: String = "GET", body: String? = null) = withContext(Dispatchers.IO) {
        val requestToken = session.token();val builder = Request.Builder().url(BuildConfig.API_BASE_URL + path).header("Accept", "application/json");requestToken?.let { builder.header("Authorization", "Bearer $it") };when (method) {"POST" -> builder.post((body ?: "{}").toRequestBody(media));"PATCH" -> builder.patch((body ?: "{}").toRequestBody(media))};http.newCall(builder.build()).execute().use { response ->val raw = response.body?.string() ?: "{}";if (!response.isSuccessful) {val code = runCatching {json.parseToJsonElement(raw).jsonObject["error"]?.jsonPrimitive?.content}.getOrNull();if (response.code == 401) session.invalidateIfCurrent(requestToken);if (response.code == 403 && code == "FORBIDDEN") session.authorizationChanged();throw ApiException(response.code, code)};raw}
    }
    suspend fun queue(query: String = ""): List<TelecallingLead> {val suffix = if (query.isBlank()) "" else "&q=${enc(query)}";return json.decodeFromString(call("api/v1/mobile/telecalling?view=queue$suffix"))}
    suspend fun history(leadId: String): List<LeadCallHistoryItem> = json.decodeFromString(call("api/v1/mobile/telecalling?view=history&leadId=${enc(leadId)}"))
    suspend fun callbacks(): List<CallbackQueueItem> = json.decodeFromString(call("api/v1/mobile/telecalling?view=callbacks"))
    suspend fun salesActions(): List<TelecallingSalesAction> = json.decodeFromString(call("api/v1/mobile/telecalling?view=sales-actions"))
    suspend fun recordCall(leadId: String,result: String,notes: String?,nextCallbackAt: String?,followUpTaskId:String?=null): RecordLeadCallResponse = json.decodeFromString(call("api/v1/mobile/telecalling","POST",json.encodeToString(RecordLeadCallRequest(leadId = leadId, result = result, notes = notes, nextCallbackAt = nextCallbackAt,followUpTaskId=followUpTaskId))))
    suspend fun updateSalesAction(actionId: String, status: String) {call("api/v1/mobile/telecalling","POST",json.encodeToString(UpdateSalesActionRequest(actionId = actionId, status = status)))}
}
