package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.CompanyProfile
import com.salespunch360.mobile.data.CompanyProfileClient
import com.salespunch360.mobile.data.CompanyProfileUpdate
import com.salespunch360.mobile.data.SecureSession
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class CompanyProfileState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val profile: CompanyProfile? = null,
    val message: String? = null,
    val error: String? = null,
)

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

    fun save(update: CompanyProfileUpdate) {
        if (_state.value.saving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(saving = true, message = null, error = null)
            _state.value = try {
                CompanyProfileState(
                    loading = false,
                    profile = client.save(update),
                    message = "Company profile saved. You can now add employees.",
                )
            } catch (e: Exception) {
                _state.value.copy(saving = false, error = message(e))
            }
        }
    }

    private fun message(e: Exception) = when ((e as? ApiException)?.code) {
        "INVALID_INPUT" -> "Check the required company details and try again."
        "FORBIDDEN" -> "Only an authorized Company Admin can update company details."
        else -> if (e is IOException) "You're offline. Reconnect and try again." else "Company details couldn't be updated."
    }
}
