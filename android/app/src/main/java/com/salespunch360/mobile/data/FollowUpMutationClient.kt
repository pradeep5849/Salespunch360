package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class FollowUpMutationClient(private val session: SecureSession) {
    private val http = OkHttpClient()
    private val media = "application/json".toMediaType()
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun completeCall(taskId: String, outcomeNote: String) = mutate("COMPLETE_CALL", taskId, outcomeNote)

    suspend fun telecallers(): List<TelecallerOption> = withContext(Dispatchers.IO) {
        val token = session.token()
        val request = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/follow-ups?view=telecallers")
            .header("Accept", "application/json")
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string() ?: "[]"
            if (!response.isSuccessful) {
                if (response.code == 401) session.invalidateIfCurrent(token)
                if (response.code == 403) session.authorizationChanged()
                throw ApiException(response.code, "FOLLOW_UP_OPTIONS_FAILED")
            }
            json.decodeFromString<List<TelecallerOption>>(raw)
        }
    }

    suspend fun create(leadId: String, dueDate: String, type: String, notes: String?, assignedUserId: String? = null) = withContext(Dispatchers.IO) {
        val token = session.token()
        val body = JSONObject()
            .put("action", "CREATE")
            .put("leadId", leadId)
            .put("dueDate", dueDate)
            .put("type", type)
            .apply {
                notes?.let { put("notes", it) }
                assignedUserId?.let { put("assignedUserId", it) }
            }.toString()
        val request = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/follow-ups")
            .header("Accept", "application/json")
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .post(body.toRequestBody(media))
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                if (response.code == 401) session.invalidateIfCurrent(token)
                if (response.code == 403) session.authorizationChanged()
                throw ApiException(response.code, "FOLLOW_UP_CREATE_FAILED")
            }
        }
    }

    private suspend fun mutate(action: String, taskId: String, outcomeNote: String? = null) = withContext(Dispatchers.IO) {
        val token = session.token()
        val body = JSONObject().put("action", action).put("taskId", taskId).apply { outcomeNote?.let { put("outcomeNote", it) } }.toString()
        val request = Request.Builder()
            .url(BuildConfig.API_BASE_URL + "api/v1/mobile/follow-ups")
            .header("Accept", "application/json")
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .post(body.toRequestBody(media))
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                if (response.code == 401) session.invalidateIfCurrent(token)
                if (response.code == 403) session.authorizationChanged()
                throw ApiException(response.code, "FOLLOW_UP_MUTATION_FAILED")
            }
        }
    }
}
