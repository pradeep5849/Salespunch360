package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.MobileRouteSignal
import java.io.IOException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
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
    private val deviceAdmin = DeviceAdminClient(session)
    private val verification = EmailVerificationClient(session)
    private val companyProfile = CompanyProfileClient(session)
    private val _state = MutableStateFlow(EmployeesState())
    val state: StateFlow<EmployeesState> = _state

    init {
        refresh()
        watchEmailVerification()
    }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null, notice = null)
        try {
            val loaded = coroutineScope {
                val contextDeferred = async { api.employees() }
                val verifiedDeferred = async { runCatching { verification.status() }.getOrNull() }
                val profileDeferred = async { runCatching { companyProfile.load().profileComplete }.getOrNull() }
                Triple(contextDeferred.await(), verifiedDeferred.await(), profileDeferred.await())
            }
            _state.value = EmployeesState(
                loading = false,
                context = loaded.first,
                emailVerified = loaded.second,
                companyProfileComplete = loaded.third,
            )
        } catch (e: Exception) {
            _state.value = _state.value.copy(loading=false,error=if (e is IOException) "You're offline. Reconnect and try again." else "Employees couldn't be loaded. Please try again.")
        }
    }

    private fun watchEmailVerification() = viewModelScope.launch {
        while (isActive) {
            delay(5_000)
            val current = _state.value
            if (MobileRouteSignal.current.value == "Employees" && current.emailVerified == false && !current.loading) {
                val verified = runCatching { verification.status() }.getOrNull()
                if (verified == true) _state.value = _state.value.copy(emailVerified = true)
            }
        }
    }

    fun create(request: CreateEmployeeRequest, onSuccess: () -> Unit) = mutate("Employee created.",onSuccess) { api.createEmployee(request) }
    fun edit(request:EditEmployeeRequest,onSuccess:()->Unit)=mutate("Employee updated.",onSuccess){api.editEmployee(request)}
    fun changeRole(request:ChangeEmployeeRoleRequest,onSuccess:()->Unit)=mutate("Employee role updated.",onSuccess){api.changeEmployeeRole(request)}

    fun resetDevice(employee:Employee,onSuccess:()->Unit){
        if(_state.value.mutating)return
        viewModelScope.launch{
            _state.value=_state.value.copy(mutating=true,error=null,notice=null)
            try{
                deviceAdmin.reset(employee.id)
                _state.value=_state.value.copy(mutating=false,notice="${employee.name}'s registered mobile device was reset.")
                onSuccess()
            }catch(e:Exception){
                val message=when(e){
                    is IOException->"You're offline. Reconnect before resetting the device."
                    is DeviceAdminFailure->when(e.code){
                        "FORBIDDEN"->"Only the Primary Admin can reset employee devices."
                        "NOT_FOUND"->"This employee is no longer available."
                        else->"The registered device couldn't be reset."
                    }
                    else->"The registered device couldn't be reset."
                }
                _state.value=_state.value.copy(mutating=false,error=message)
            }
        }
    }

    private fun mutate(notice:String,onSuccess:()->Unit,block:suspend()->Any){
        if (_state.value.mutating) return
        viewModelScope.launch {
            _state.value = _state.value.copy(mutating=true,error=null,notice=null)
            try {
                block();val context=api.employees()
                _state.value=EmployeesState(loading=false,context=context,notice=notice,emailVerified=_state.value.emailVerified?:true,companyProfileComplete=_state.value.companyProfileComplete?:true)
                onSuccess()
            } catch (e: Exception) {
                val code=(e as? ApiException)?.code
                _state.value=_state.value.copy(mutating=false,emailVerified=if(code=="EMAIL_VERIFICATION_REQUIRED")false else _state.value.emailVerified,companyProfileComplete=if(code=="COMPANY_PROFILE_REQUIRED")false else _state.value.companyProfileComplete,error=message(e))
            }
        }
    }

    fun resendVerification() {
        if (_state.value.verificationSending) return
        viewModelScope.launch {
            _state.value = _state.value.copy(verificationSending = true, error = null, notice = null)
            try { verification.resend();_state.value=_state.value.copy(verificationSending=false,notice="If verification is still needed, a new link has been sent.") }
            catch (e: Exception) {_state.value=_state.value.copy(verificationSending=false,error=if(e is IOException)"You're offline. Reconnect and try again." else "We couldn't send the verification email. Please try again.")}
        }
    }

    fun setActive(employee: Employee, active: Boolean) {
        if (_state.value.mutating) return
        viewModelScope.launch {
            _state.value = _state.value.copy(mutating=true,error=null,notice=null)
            try {api.setEmployeeActive(employee.id,active);_state.value=_state.value.copy(loading=false,context=api.employees(),mutating=false,notice=if(active)"${employee.name} reactivated." else "${employee.name} deactivated.")}
            catch (e: Exception) {_state.value=_state.value.copy(mutating=false,error=message(e))}
        }
    }

    fun dismiss() { _state.value = _state.value.copy(error = null, notice = null) }

    private fun message(e: Exception) = when ((e as? ApiException)?.code) {
        "EMAIL_VERIFICATION_REQUIRED" -> "Verify your email before adding Managers or Sales employees."
        "COMPANY_PROFILE_REQUIRED" -> "Complete Company Details before adding Managers or Sales employees."
        "EMAIL_IN_USE" -> "This email address is already in use."
        "PHONE_IN_USE" -> "This mobile number is already in use in your company."
        "SEAT_LIMIT" -> "No seat is available for this role."
        "LIFECYCLE_BLOCKED" -> "Your entitlement currently blocks employee changes."
        "MANAGERS_DISABLED" -> "Managers aren't available for this company structure."
        "INVALID_MANAGER" -> "Choose an active Manager from your company."
        "BRANCH_REQUIRED" -> "Choose at least one branch for Selected Branches access."
        "INVALID_BRANCH" -> "One or more selected branches are unavailable."
        "MANAGER_TYPE_CONFLICT" -> "Finish or reassign this Manager's open work before changing the Manager type."
        "INVALID_RATE" -> "Enter a valid travel rate."
        "INVALID_INPUT" -> "Check the employee details and try again."
        "FORBIDDEN" -> "Only the Primary Admin can manage Sales users in the app."
        else -> if (e is IOException) "You're offline. Reconnect before making changes." else "The change couldn't be completed."
    }
}
