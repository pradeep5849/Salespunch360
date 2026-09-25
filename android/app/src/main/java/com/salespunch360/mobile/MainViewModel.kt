package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.data.ForbiddenMobileRoleException
import com.salespunch360.mobile.data.LocationPayload
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.data.Workspace
import com.salespunch360.mobile.data.WorkspacePreferenceStore
import com.salespunch360.mobile.data.resolveWorkspace
import com.salespunch360.mobile.data.validatedWorkspaces
import com.salespunch360.mobile.location.TrackingService
import com.salespunch360.mobile.push.PushNotifications
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class AppStatus { STARTING, SIGNED_OUT, AUTHENTICATED, RECOVERABLE_ERROR }

data class AppState(
    val status: AppStatus = AppStatus.STARTING,
    val bootstrap: Bootstrap? = null,
    val workspace: Workspace? = null,
    val accountPath: String = "/workspace/account",
    val accountSessionEpoch: Int = 0,
    val message: String? = null,
    val submitting: Boolean = false,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val session = SecureSession(app)
    private val api = ApiClient(session)
    private val workspacePreference = WorkspacePreferenceStore(app)
    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state

    private var pendingAccountPath: String? = null

    init {
        viewModelScope.launch {
            SecureSession.invalidations.collect { owner ->
                secureSignOut("Your session expired. Please sign in again.", owner)
            }
        }
        viewModelScope.launch {
            SecureSession.authorizationChanges.collect {
                refreshAuthorization()
            }
        }
        if (session.token() == null) {
            _state.value = AppState(AppStatus.SIGNED_OUT)
        } else {
            validateSession()
        }
    }

    fun login(email: String, password: String) {
        if (_state.value.submitting) return
        viewModelScope.launch {
            _state.value = AppState(AppStatus.SIGNED_OUT, submitting = true)
            try {
                val bootstrap = api.login(email.trim(), password)
                if (applyBootstrap(bootstrap)) {
                    PushNotifications.register(getApplication())
                }
            } catch (error: Exception) {
                if (error is ForbiddenMobileRoleException) session.clear()
                _state.value = AppState(AppStatus.SIGNED_OUT, message = loginMessage(error))
            }
        }
    }

    fun validateSession() = viewModelScope.launch {
        _state.value = _state.value.copy(status = AppStatus.STARTING, message = null)
        try {
            val bootstrap = api.bootstrap()
            if (applyBootstrap(bootstrap)) {
                PushNotifications.register(getApplication())
            }
        } catch (error: Exception) {
            when (error) {
                is IOException -> _state.value = _state.value.copy(
                    status = AppStatus.RECOVERABLE_ERROR,
                    message = "You're offline. Reconnect and try again.",
                )
                is ForbiddenMobileRoleException -> secureSignOut("This account cannot sign in to the mobile app.")
                is ApiException -> if (error.status == 401) {
                    secureSignOut("Your session expired. Please sign in again.")
                } else {
                    _state.value = _state.value.copy(
                        status = AppStatus.RECOVERABLE_ERROR,
                        message = "We couldn't validate your session. Please try again.",
                    )
                }
                else -> _state.value = _state.value.copy(
                    status = AppStatus.RECOVERABLE_ERROR,
                    message = "We couldn't validate your session. Please try again.",
                )
            }
        }
    }

    fun attendance(start: Boolean, location: LocationPayload, onSuccess: () -> Unit) = viewModelScope.launch {
        try {
            api.attendance(if (start) "START" else "END", location)
            val refreshed = api.bootstrap()
            if (applyBootstrap(refreshed, forcedWorkspace = Workspace.SALES)) onSuccess()
        } catch (error: ApiException) {
            if (error.status == 403) refreshAuthorization()
            _state.value = _state.value.copy(
                message = "Attendance action could not be completed. Check your location and connection.",
            )
        } catch (_: Exception) {
            _state.value = _state.value.copy(
                message = "Attendance action could not be completed. Check your location and connection.",
            )
        }
    }

    fun switchToAccount(path: String = "/workspace/account") {
        val current = _state.value
        val bootstrap = current.bootstrap ?: return
        val authorized = validatedWorkspaces(bootstrap)
        if (Workspace.ACCOUNT !in authorized) return
        val safe = nativeAccountPathOrNull(path) ?: "/workspace/account"
        workspacePreference.save(Workspace.ACCOUNT)
        _state.value = current.copy(workspace = Workspace.ACCOUNT, accountPath = safe, message = null)
    }

    fun switchToSales() {
        viewModelScope.launch {
            try {
                applyBootstrap(api.bootstrap(), forcedWorkspace = Workspace.SALES)
            } catch (error: Exception) {
                if (error is ApiException && error.status == 401) {
                    secureSignOut("Your session expired. Please sign in again.")
                } else {
                    _state.value = _state.value.copy(message = "Sales access could not be refreshed.")
                }
            }
        }
    }

    fun handleDeepLink(raw: String?) {
        val safe = raw?.let(::nativeAccountPathOrNull) ?: return
        pendingAccountPath = safe
        val bootstrap = _state.value.bootstrap
        if (bootstrap != null && Workspace.ACCOUNT in validatedWorkspaces(bootstrap)) {
            switchToAccount(safe)
        }
    }

    fun clearMessage() {
        _state.value = _state.value.copy(message = null)
    }

    fun logout() = viewModelScope.launch {
        val owner = session.userId()
        TrackingService.stop(getApplication())
        try {
            api.logout()
        } finally {
            clearSalesLocal(owner)
            session.clear()
            workspacePreference.clear()
            pendingAccountPath = null
            _state.value = AppState(AppStatus.SIGNED_OUT)
        }
    }

    private fun refreshAuthorization() = viewModelScope.launch {
        try {
            applyBootstrap(api.bootstrap())
        } catch (error: Exception) {
            if (error is ApiException && error.status == 401) {
                secureSignOut("Your session expired. Please sign in again.")
            }
        }
    }

    private suspend fun applyBootstrap(
        bootstrap: Bootstrap,
        forcedWorkspace: Workspace? = null,
    ): Boolean {
        val authorized = validatedWorkspaces(bootstrap)
        if (authorized.isEmpty()) {
            secureSignOut("This account no longer has an authorized mobile workspace.")
            return false
        }

        if (Workspace.SALES !in authorized) {
            TrackingService.stop(getApplication())
            clearSalesLocal(session.userId())
        } else {
            // Server-confirmed attendance is the authority for background GPS. Reconcile on every
            // bootstrap so an app/process restart cannot leave tracking running while attendance is OFF,
            // and an active attendance can resume tracking after Android recreates the app.
            if (bootstrap.features.gpsTrackingEnabled && bootstrap.attendance != null) {
                TrackingService.start(getApplication())
            } else {
                TrackingService.stop(getApplication())
            }
        }

        val deepPath = pendingAccountPath
        val desired = when {
            deepPath != null && Workspace.ACCOUNT in authorized -> Workspace.ACCOUNT
            forcedWorkspace != null && forcedWorkspace in authorized -> forcedWorkspace
            else -> resolveWorkspace(authorized, workspacePreference.get())
        }

        if (desired == null) {
            secureSignOut("This account no longer has an authorized mobile workspace.")
            return false
        }

        val accountPath = deepPath ?: _state.value.accountPath
        if (deepPath != null && desired == Workspace.ACCOUNT) pendingAccountPath = null
        workspacePreference.save(desired)

        _state.value = AppState(
            status = AppStatus.AUTHENTICATED,
            bootstrap = bootstrap,
            workspace = desired,
            accountPath = accountPath,
            accountSessionEpoch = _state.value.accountSessionEpoch,
            message = _state.value.message,
        )
        return true
    }

    private suspend fun secureSignOut(
        message: String,
        invalidatedOwner: String? = session.userId(),
    ) {
        TrackingService.stop(getApplication())
        clearSalesLocal(invalidatedOwner)
        session.clear()
        workspacePreference.clear()
        pendingAccountPath = null
        _state.value = AppState(AppStatus.SIGNED_OUT, message = message)
    }

    private suspend fun clearSalesLocal(owner: String?) {
        owner?.let {
            getApplication<SalesPunchApp>().database.locations().clearOwner(it)
            WorkManager.getInstance(getApplication()).cancelUniqueWork("location-sync-$it")
        }
    }

    private fun loginMessage(error: Exception) = when {
        error is ForbiddenMobileRoleException -> "This account cannot sign in to the mobile app."
        error is IOException -> "You're offline. Check your connection and try again."
        error is ApiException && error.status == 429 -> "Too many sign-in attempts. Please wait and try again."
        error is ApiException && error.status in listOf(400, 401, 403) -> "Email or password is incorrect."
        else -> "Unable to sign in right now. Please try again."
    }
}
