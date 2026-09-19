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
import okhttp3.MultipartBody
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
    val hasLogo: Boolean = false,
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

    private fun error(raw: String, status: Int, requestToken: String?): ApiException {
        val code = runCatching {
            json.parseToJsonElement(raw).jsonObject["error"]?.jsonPrimitive?.content
        }.getOrNull()
        if (status == 401) session.invalidateIfCurrent(requestToken)
        if (status == 403 && code == "FORBIDDEN") session.authorizationChanged()
        return ApiException(status, code)
    }

    private suspend fun call(method: String, body: String? = null) = withContext(Dispatchers.IO) {
        val requestToken = session.token()
        val builder = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/company")
            .header("Accept", "application/json")
        requestToken?.let { builder.header("Authorization", "Bearer $it") }
        if (method == "PATCH") builder.patch((body ?: "{}").toRequestBody(media))
        http.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string() ?: "{}"
            if (!response.isSuccessful) throw error(raw, response.code, requestToken)
            raw
        }
    }

    suspend fun load(): CompanyProfile =
        json.decodeFromString<CompanyProfileEnvelope>(call("GET")).company

    suspend fun save(update: CompanyProfileUpdate): CompanyProfile =
        json.decodeFromString<CompanyProfileEnvelope>(
            call("PATCH", json.encodeToString(CompanyProfilePatch(data = update)))
        ).company

    suspend fun uploadLogo(bytes: ByteArray, mimeType: String): CompanyProfile = withContext(Dispatchers.IO) {
        if (bytes.isEmpty() || bytes.size > MAX_LOGO_BYTES) throw ApiException(400, "LOGO_INVALID")
        val normalizedType = mimeType.lowercase()
        if (normalizedType !in LOGO_TYPES) throw ApiException(400, "LOGO_INVALID")

        val requestToken = session.token()
        val extension = when (normalizedType) {
            "image/jpeg" -> "jpg"
            "image/png" -> "png"
            else -> "webp"
        }
        val multipart = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "logo",
                "company-logo.$extension",
                bytes.toRequestBody(normalizedType.toMediaType()),
            )
            .build()
        val builder = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/company/logo")
            .header("Accept", "application/json")
            .post(multipart)
        requestToken?.let { builder.header("Authorization", "Bearer $it") }

        http.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string() ?: "{}"
            if (!response.isSuccessful) throw error(raw, response.code, requestToken)
            json.decodeFromString<CompanyProfileEnvelope>(raw).company
        }
    }

    companion object {
        const val MAX_LOGO_BYTES = 5 * 1024 * 1024
        val LOGO_TYPES = setOf("image/jpeg", "image/png", "image/webp")
    }
}
