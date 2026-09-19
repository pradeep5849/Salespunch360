package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
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

class RegistrationClient(private val session: SecureSession) {
    private val json = Json { ignoreUnknownKeys = true }
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()
    private val media = "application/json".toMediaType()

    suspend fun register(
        productEdition: String,
        companyName: String,
        adminName: String,
        adminEmail: String,
        adminPassword: String,
        confirmPassword: String,
    ): Bootstrap = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("productEdition", productEdition)
            put("companyName", companyName.trim())
            put("adminName", adminName.trim())
            put("adminEmail", adminEmail.trim())
            put("adminPassword", adminPassword)
            put("confirmPassword", confirmPassword)
            put("legalConsent", true)
        }
        val request = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/auth/register")
            .header("Accept", "application/json")
            .post(payload.toString().toRequestBody(media))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string() ?: "{}"
            val root = runCatching { json.parseToJsonElement(raw).jsonObject }.getOrNull()
            if (!response.isSuccessful) {
                val code = root?.get("error")?.jsonPrimitive?.content
                throw ApiException(response.code, code)
            }
            val bootstrap = root?.get("bootstrap")
                ?: throw ApiException(500, "INVALID_RESPONSE")
            val accessToken = root["accessToken"]?.jsonPrimitive?.content
                ?: throw ApiException(500, "INVALID_RESPONSE")
            val decoded = json.decodeFromJsonElement(Bootstrap.serializer(), bootstrap)
            session.save(accessToken, decoded.user.id)
            decoded
        }
    }
}
