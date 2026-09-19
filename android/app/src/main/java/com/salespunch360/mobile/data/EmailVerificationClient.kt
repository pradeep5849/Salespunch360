package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class EmailVerificationClient(private val session: SecureSession) {
    private val json = Json { ignoreUnknownKeys = true }
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()
    private val media = "application/json".toMediaType()

    private suspend fun call(method: String) = withContext(Dispatchers.IO) {
        val requestToken = session.token()
        val builder = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/auth/email-verification")
            .header("Accept", "application/json")
        requestToken?.let { builder.header("Authorization", "Bearer $it") }
        if (method == "POST") builder.post("{}".toRequestBody(media))

        http.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string() ?: "{}"
            if (!response.isSuccessful) {
                val code = runCatching {
                    json.parseToJsonElement(raw).jsonObject["error"]?.jsonPrimitive?.content
                }.getOrNull()
                if (response.code == 401) session.invalidateIfCurrent(requestToken)
                if (response.code == 403 && code == "FORBIDDEN") session.authorizationChanged()
                throw ApiException(response.code, code)
            }
            raw
        }
    }

    suspend fun status(): Boolean {
        val root = json.parseToJsonElement(call("GET")).jsonObject
        return root["verified"]?.jsonPrimitive?.content?.toBoolean() == true
    }

    suspend fun resend() {
        call("POST")
    }
}
