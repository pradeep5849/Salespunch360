package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class AdministrationState(
    val mode: String = "settings",
    val loading: Boolean = false,
    val data: JsonElement = JsonObject(emptyMap()),
    val error: String? = null,
    val message: String? = null
)

class AccountAdministrationViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(AdministrationState())
    val state = _state.asStateFlow()

    private fun success(text: String = "Saved successfully") {
        _state.value = _state.value.copy(message = text, error = null)
        viewModelScope.launch {
            delay(2500)
            if (_state.value.message == text) _state.value = _state.value.copy(message = null)
        }
    }

    private fun failure(text: String) {
        _state.value = _state.value.copy(loading = false, error = text, message = null)
        viewModelScope.launch {
            delay(5000)
            if (_state.value.error == text) _state.value = _state.value.copy(error = null)
        }
    }

    fun load(mode: String) {
        _state.value = _state.value.copy(mode = mode, loading = true, error = null)
        viewModelScope.launch {
            runCatching {
                when (mode) {
                    "users" -> api.accountUsers()
                    "settings", "general", "party-settings", "party-additional-fields", "transaction-sms", "transaction-settings", "custom-fields", "modules", "print-templates", "item-settings" -> api.accountAdministration("settings")
                    "notifications" -> api.accountAdministration("notifications")
                    "tax-settings" -> api.accountTax()
                    "tax-reports" -> api.accountTax(
                        mapOf(
                            "from" to java.time.LocalDate.now().withDayOfYear(1).toString(),
                            "to" to java.time.LocalDate.now().toString()
                        )
                    )
                    else -> api.accountUtility(mode)
                }
            }.onSuccess {
                _state.value = _state.value.copy(loading = false, data = it)
            }.onFailure {
                failure(it.message ?: "Unable to load")
            }
        }
    }

    fun saveUser(payload: JsonObject) {
        viewModelScope.launch {
            runCatching { api.saveAccountUser(payload.containsKey("userId"), payload) }
                .onSuccess { success(if (payload.containsKey("userId")) "Employee updated successfully" else "Employee added successfully"); load("users") }
                .onFailure { failure(it.message ?: "Employee save failed") }
        }
    }

    // Administration settings can use either object or array JSON payloads.
    fun save(section: String, payload: JsonElement) {
        _state.value = _state.value.copy(loading = true, error = null, message = null)
        viewModelScope.launch {
            runCatching {
                if (section.startsWith("tax")) {
                    api.saveAccountTax(payload.jsonObject)
                } else {
                    api.saveAccountAdministration("settings", section, payload)
                }
            }.onSuccess {
                success()
                load(_state.value.mode)
            }.onFailure {
                failure(it.message ?: "Save failed")
            }
        }
    }

    fun uploadSignature(name: String, mime: String, bytes: ByteArray) {
        viewModelScope.launch {
            runCatching { api.uploadAccountSignature(name, mime, bytes) }
                .onSuccess { success("Signature replaced successfully") }
                .onFailure { failure(it.message ?: "Signature upload failed") }
        }
    }

    fun fileError(message: String) {
        failure(message)
    }

    fun removeSignature() {
        viewModelScope.launch {
            runCatching { api.removeAccountSignature() }
                .onSuccess { success("Signature removed successfully") }
                .onFailure { failure(it.message ?: "Signature removal failed") }
        }
    }
}
