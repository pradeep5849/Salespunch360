package com.salespunch360.mobile.data

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

@Serializable
data class CompanyProfile(
    val name: String,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val locality: String? = null,
    val city: String? = null,
    val state: String? = null,
    val postalCode: String? = null,
    val country: String? = null,
    val primaryContactName: String? = null,
    val primaryPhone: String? = null,
    val contactEmail: String? = null,
    val profileComplete: Boolean = false,
)

@Serializable
data class CompanyProfileUpdate(
    val name: String,
    val addressLine1: String,
    val addressLine2: String? = null,
    val locality: String? = null,
    val city: String,
    val state: String,
    val postalCode: String,
    val country: String,
    val primaryContactName: String,
    val primaryPhone: String,
    val contactEmail: String,
)

@Serializable private data class CompanyProfileEnvelope(val company: CompanyProfile)
@Serializable private data class CompanyProfilePatch(val section: String = "profile", val data: CompanyProfileUpdate)

class CompanyProfileClient(private val session: SecureSession) {
    private val json = Json { ignoreUnknownKeys = true }
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()
    private val media = "application/json".toMediaType()

    private suspend fun call(method: String, body: String? = null) = withContext(Dispatchers.IO) {
        val requestToken = session.token()
        val builder = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/company")
            .header("Accept", "application/json")
        requestToken?.let { builder.header("Authorization", "Bearer $it") }
        if (method == "PATCH") builder.patch((body ?: "{}").toRequestBody(media))
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

    suspend fun load(): CompanyProfile =
        json.decodeFromString<CompanyProfileEnvelope>(call("GET")).company

    suspend fun save(update: CompanyProfileUpdate): CompanyProfile =
        json.decodeFromString<CompanyProfileEnvelope>(
            call("PATCH", json.encodeToString(CompanyProfilePatch(data = update)))
        ).company
}
