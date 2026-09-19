package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class EmployeesState(
    val loading: Boolean = true,
    val context: EmployeeContext? = null,
    val error: String? = null,
    val mutating: Boolean = false,
    val notice: String? = null,
    val emailVerified: Boolean? = null,
    val verificationSending: Boolean = false,
    val companyProfileComplete: Boolean? = null,
)

class EmployeesViewModel(app: Application) : AndroidViewModel(app) {
    private val session = SecureSession(app)
    private val api = ApiClient(session)
    private val verification = EmailVerificationClient(session)
    private val companyProfile = CompanyProfileClient(session)
    private val _state = MutableStateFlow(EmployeesState())
    val state: StateFlow<EmployeesState> = _state

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null, notice = null)
        try {
            val context = api.employees()
            val verified = runCatching { verification.status() }.getOrNull()
            val profileComplete = runCatching { companyProfile.load().profileComplete }.getOrNull()
            _state.value = EmployeesState(
                loading = false,
                context = context,
                emailVerified = verified,
                companyProfileComplete = profileComplete,
            )
        } catch (e: Exception) {
            _state.value = _state.value.copy(
                loading = false,
                error = if (e is IOException) "You're offline. Reconnect and try again." else "Employees couldn't be loaded. Please try again.",
            )
        }
    }

    fun create(request: CreateEmployeeRequest, onSuccess: () -> Unit) {
        if (_state.value.mutating) return
        viewModelScope.launch {
            _state.value = _state.value.copy(mutating = true, error = null, notice = null)
            try {
                api.createEmployee(request)
                val context = api.employees()
                _state.value = EmployeesState(
                    loading = false,
                    context = context,
                    notice = "Employee created.",
                    emailVerified = true,
                    companyProfileComplete = true,
                )
                onSuccess()
            } catch (e: Exception) {
                val code = (e as? ApiException)?.code
                _state.value = _state.value.copy(
                    mutating = false,
                    emailVerified = if (code == "EMAIL_VERIFICATION_REQUIRED") false else _state.value.emailVerified,
                    companyProfileComplete = if (code == "COMPANY_PROFILE_REQUIRED") false else _state.value.companyProfileComplete,
                    error = message(e),
                )
            }
        }
    }

    fun resendVerification() {
        if (_state.value.verificationSending) return
        viewModelScope.launch {
            _state.value = _state.value.copy(verificationSending = true, error = null, notice = null)
            try {
                verification.resend()
                _state.value = _state.value.copy(
                    verificationSending = false,
                    notice = "If verification is still needed, a new link has been sent.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    verificationSending = false,
                    error = if (e is IOException) "You're offline. Reconnect and try again." else "We couldn't send the verification email. Please try again.",
                )
            }
        }
    }

    fun setActive(employee: Employee, active: Boolean) {
        if (_state.value.mutating) return
        viewModelScope.launch {
            _state.value = _state.value.copy(mutating = true, error = null, notice = null)
            try {
                api.setEmployeeActive(employee.id, active)
                _state.value = _state.value.copy(
                    loading = false,
                    context = api.employees(),
                    mutating = false,
                    notice = if (active) "${employee.name} reactivated." else "${employee.name} deactivated.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(mutating = false, error = message(e))
            }
        }
    }

    fun dismiss() { _state.value = _state.value.copy(error = null, notice = null) }

    private fun message(e: Exception) = when ((e as? ApiException)?.code) {
        "EMAIL_VERIFICATION_REQUIRED" -> "Verify your email before adding employees."
        "COMPANY_PROFILE_REQUIRED" -> "Complete Company Details before adding Managers or Sales employees."
        "EMAIL_IN_USE" -> "This email address is already in use."
        "PHONE_IN_USE" -> "This mobile number is already in use in your company."
        "SEAT_LIMIT" -> "No seat is available for this role."
        "LIFECYCLE_BLOCKED" -> "Your entitlement currently blocks employee changes."
        "MANAGERS_DISABLED" -> "Managers aren't available for this company structure."
        "INVALID_MANAGER" -> "Choose an active Manager from your company."
        "INVALID_INPUT" -> "Check the employee details. Password must be at least 12 characters with uppercase, lowercase and a number; phone and employee code must also use valid formats."
        "FORBIDDEN" -> "Employee management requires a Company Admin account."
        else -> if (e is IOException) "You're offline. Reconnect before making changes." else "The change couldn't be completed."
    }
}
