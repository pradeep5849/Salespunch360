package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class UtilityState(
    val loading: Boolean = false,
    val rows: JsonArray = JsonArray(emptyList()),
    val preview: JsonObject? = null,
    val file: Pair<String, ByteArray>? = null,
    val error: String? = null,
    val message: String? = null
)

class AccountUtilityViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(UtilityState())
    val state = _state.asStateFlow()

    fun load(mode: String) {
        viewModelScope.launch {
            runCatching {
                if (mode == "import") {
                    api.accountImports()
                } else {
                    api.accountUtility(if (mode == "recycle") "recycle-bin" else mode)
                }
            }.onSuccess {
                _state.value = _state.value.copy(rows = it, loading = false, error = null)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message)
            }
        }
    }

    fun upload(type: String, name: String, mime: String, bytes: ByteArray, update: Boolean) {
        viewModelScope.launch {
            runCatching { api.uploadAccountImport(type, name, mime, bytes, update) }
                .onSuccess { _state.value = _state.value.copy(preview = it, message = "Validated on server") }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun execute(id: String) {
        viewModelScope.launch {
            runCatching { api.executeAccountImport(id) }
                .onSuccess {
                    _state.value = _state.value.copy(message = "Import committed by server", preview = null)
                    load("import")
                }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun export(type: String, format: String) {
        download("$type.$format") { api.accountMasterExport(type, format) }
    }

    fun backup() {
        download("salespunch360-account-backup.json") { api.accountBackup() }
    }

    private fun download(name: String, block: suspend () -> ByteArray) {
        viewModelScope.launch {
            runCatching { block() }
                .onSuccess { _state.value = _state.value.copy(file = name to it) }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun restored(id: String) {
        viewModelScope.launch {
            runCatching { api.restoreAccountRecycle(id) }
                .onSuccess { load("recycle") }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun consumed() {
        _state.value = _state.value.copy(file = null)
    }
}
