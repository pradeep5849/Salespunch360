package com.salespunch360.mobile

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.CompanyProfile
import com.salespunch360.mobile.data.CompanyProfileClient
import com.salespunch360.mobile.data.CompanyProfileUpdate
import com.salespunch360.mobile.data.SecureSession
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class CompanyProfileState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val uploadingLogo: Boolean = false,
    val profile: CompanyProfile? = null,
    val message: String? = null,
    val error: String? = null,
)

private data class LogoUpload(val bytes: ByteArray, val mimeType: String)

class CompanyProfileViewModel(app: Application) : AndroidViewModel(app) {
    private val client = CompanyProfileClient(SecureSession(app))
    private val _state = MutableStateFlow(CompanyProfileState())
    val state: StateFlow<CompanyProfileState> = _state

    init { load() }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, message = null, error = null)
        _state.value = try {
            CompanyProfileState(loading = false, profile = client.load())
        } catch (e: Exception) {
            CompanyProfileState(loading = false, profile = _state.value.profile, error = message(e))
        }
    }

    fun save(update: CompanyProfileUpdate, onSaved: (CompanyProfile) -> Unit = {}) {
        if (_state.value.saving || _state.value.uploadingLogo) return
        viewModelScope.launch {
            _state.value = _state.value.copy(saving = true, message = null, error = null)
            try {
                val saved = client.save(update)
                _state.value = CompanyProfileState(
                    loading = false,
                    profile = saved,
                    message = if (saved.profileComplete) {
                        "Company details saved. Employee creation is now available."
                    } else {
                        "Company details saved. Complete the remaining required fields."
                    },
                )
                onSaved(saved)
            } catch (e: Exception) {
                _state.value = _state.value.copy(saving = false, error = message(e))
            }
        }
    }

    fun uploadLogo(uri: Uri) {
        if (_state.value.saving || _state.value.uploadingLogo) return
        viewModelScope.launch {
            _state.value = _state.value.copy(uploadingLogo = true, message = null, error = null)
            try {
                val upload = withContext(Dispatchers.IO) { readLogo(uri) }
                val uploaded = client.uploadLogo(upload.bytes, upload.mimeType)
                _state.value = CompanyProfileState(
                    loading = false,
                    profile = uploaded,
                    message = "Company logo uploaded successfully.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(uploadingLogo = false, error = message(e))
            }
        }
    }

    private fun readLogo(uri: Uri): LogoUpload {
        val resolver = getApplication<Application>().contentResolver
        val rawType = resolver.getType(uri)?.lowercase()
        val mimeType = when (rawType) {
            "image/jpg" -> "image/jpeg"
            in CompanyProfileClient.LOGO_TYPES -> rawType!!
            else -> throw IllegalArgumentException("LOGO_INVALID")
        }
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0
        resolver.openInputStream(uri)?.use { input ->
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > CompanyProfileClient.MAX_LOGO_BYTES) throw IllegalArgumentException("LOGO_INVALID")
                output.write(buffer, 0, read)
            }
        } ?: throw IllegalArgumentException("LOGO_INVALID")
        if (total == 0) throw IllegalArgumentException("LOGO_INVALID")
        return LogoUpload(output.toByteArray(), mimeType)
    }

    private fun message(e: Exception) = when {
        (e as? ApiException)?.code == "INVALID_INPUT" -> "Check the required company details and try again."
        (e as? ApiException)?.code == "LOGO_INVALID" || e is IllegalArgumentException -> "Choose a JPG, PNG or WebP company logo up to 5 MB."
        (e as? ApiException)?.code == "FORBIDDEN" -> "Only an authorized Company Admin can update company details."
        e is IOException -> "You're offline. Reconnect and try again."
        else -> "Company details couldn't be updated."
    }
}
