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
    val recyclePage: Int = 1,
    val recycleHasMore: Boolean = false,
    val recycleQuery:String="",
    val recycleType:String="",
    val recycleAppliedQuery:String="",
    val recycleAppliedType:String="",
    val exportTypes:List<String> = emptyList(),
    val rows: JsonArray = JsonArray(emptyList()),
    val preview: JsonObject? = null,
    val restoreReview: JsonObject? = null,
    val file: Pair<String, ByteArray>? = null,
    val error: String? = null,
    val verificationCompletedAt: String? = null,
    val message: String? = null
)

class AccountUtilityViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(UtilityState())
    val state = _state.asStateFlow()

    fun setRecycleQuery(value:String){_state.value=_state.value.copy(recycleQuery=value.take(160))}
    fun setRecycleType(value:String){_state.value=_state.value.copy(recycleType=value)}
    fun load(mode: String, more: Boolean = false) {
        if (_state.value.loading) return
        val recycleQuery=if(more)_state.value.recycleAppliedQuery else _state.value.recycleQuery
        val recycleType=if(more)_state.value.recycleAppliedType else _state.value.recycleType
        val page = if (mode == "recycle" && more) _state.value.recyclePage + 1 else 1
        if(mode == "backup") { _state.value = _state.value.copy(rows=JsonArray(emptyList()),loading=false,error=null); return }
        if(mode=="export"){
            _state.value=_state.value.copy(loading=true,error=null,exportTypes=emptyList())
            viewModelScope.launch {runCatching{api.accountUtility("export-types").map{it.jsonPrimitive.content}}.onSuccess{_state.value=_state.value.copy(loading=false,exportTypes=it)}.onFailure{_state.value=_state.value.copy(loading=false,error="Could not load authorized exports. Retry.")}}
            return
        }
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            runCatching {
                if (mode == "import") {
                    api.accountImports()
                } else {
                    api.accountUtility(if (mode == "recycle") "recycle-bin" else mode, page,if(mode=="recycle")recycleQuery else "",if(mode=="recycle")recycleType else "")
                }
            }.onSuccess {
                val rows = if(mode == "recycle") JsonArray(it.filterNot { row -> row.jsonObject["hasMore"]?.jsonPrimitive?.booleanOrNull == true }) else it
                _state.value = _state.value.copy(rows = if(more) JsonArray(_state.value.rows.toList() + rows.toList()) else rows, loading = false, error = null, verificationCompletedAt = if(mode == "verification") java.time.Instant.now().toString() else _state.value.verificationCompletedAt, recycleAppliedQuery=recycleQuery,recycleAppliedType=recycleType,recyclePage = page, recycleHasMore = mode == "recycle" && it.any { row -> row.jsonObject["hasMore"]?.jsonPrimitive?.booleanOrNull == true })
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message)
            }
        }
    }

    fun upload(type: String, name: String, mime: String, bytes: ByteArray, update: Boolean) {
        if(_state.value.loading)return
        _state.value=_state.value.copy(loading=true,error=null,message=null)
        viewModelScope.launch {
            runCatching { api.uploadAccountImport(type, name, mime, bytes, update) }
                .onSuccess { _state.value = _state.value.copy(preview = it, loading=false, message = "Validated on server") }
                .onFailure { _state.value = _state.value.copy(loading=false,error = it.message) }
        }
    }

    fun execute(id: String) {
        if(_state.value.loading)return
        _state.value=_state.value.copy(loading=true,error=null,message=null)
        viewModelScope.launch {
            runCatching { api.executeAccountImport(id) }
                .onSuccess {
                    _state.value = _state.value.copy(loading=false,message = "Import committed by server: created ${it["created"] ?: 0}, updated ${it["updated"] ?: 0}, skipped ${it["skipped"] ?: 0}", preview = null)
                    load("import")
                }
                .onFailure { _state.value = _state.value.copy(loading=false,error = it.message) }
        }
    }

    fun export(type: String, format: String) {
        download("$type.$format") { api.accountMasterExport(type, format) }
    }

    fun backup(includePrivateFiles:Boolean=false) {
        download("salespunch360-account-backup.json") { api.accountBackup(includePrivateFiles) }
    }

    private fun download(name: String, block: suspend () -> ByteArray) {
        if(_state.value.loading || _state.value.file != null)return
        _state.value=_state.value.copy(loading=true,error=null,message=null)
        viewModelScope.launch {
            runCatching { block() }
                .onSuccess { _state.value = _state.value.copy(loading=false,file = name to it) }
                .onFailure { _state.value = _state.value.copy(loading=false,error = it.message) }
        }
    }

    fun savedBackup(bytes: ByteArray) {
        viewModelScope.launch {
            val checksum = java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 0xff) }
            runCatching { api.saveAccountAdministration("settings", "manual-backup-confirmation", buildJsonObject { put("checksum",checksum) }) }
                .onFailure { _state.value=_state.value.copy(error="Backup saved, but its reminder confirmation failed. Your reminder remains active.") }
        }
    }

    fun prepareRestore(file: java.io.File) {
        if(_state.value.loading){file.delete();return}
        _state.value=_state.value.copy(loading=true,error=null,restoreReview=null,message=null)
        viewModelScope.launch {
            try { val review=api.prepareCompanyRestore(file);_state.value=_state.value.copy(loading=false,restoreReview=review) }
            catch(error:Exception){_state.value=_state.value.copy(loading=false,error=(error as? com.salespunch360.mobile.data.ApiException)?.serverMessage?:"Backup could not be validated. Select a complete backup generated by this company owner.")}
            finally { file.delete() }
        }
    }
    fun executeRestore(id:String,name:String) {
        if(_state.value.loading)return
        _state.value=_state.value.copy(loading=true,error=null,message=null)
        viewModelScope.launch {
            runCatching{api.executeCompanyRestore(id,name)}.onSuccess{_state.value=_state.value.copy(loading=false,restoreReview=null,message="Existing company restored to the saved backup state. Later entries and changes were removed.")}.onFailure{_state.value=_state.value.copy(loading=false,error=(it as? com.salespunch360.mobile.data.ApiException)?.serverMessage?:"Restore did not complete. No partial database replacement was committed.")}
        }
    }

    fun restored(id: String) {
        if (_state.value.loading) return
        _state.value = _state.value.copy(loading=true,error=null,message=null)
        viewModelScope.launch {
            runCatching { api.restoreAccountRecycle(id) }
                .onSuccess { _state.value = _state.value.copy(loading=false,message="Record restored successfully."); load("recycle") }
                .onFailure { _state.value = _state.value.copy(loading=false,error = it.message) }
        }
    }

    fun consumed() {
        _state.value = _state.value.copy(file = null)
    }
}
