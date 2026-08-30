package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.data.ForbiddenMobileRoleException
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.location.TrackingService
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class AppStatus { STARTING, SIGNED_OUT, AUTHENTICATED, RECOVERABLE_ERROR }
data class AppState(val status:AppStatus=AppStatus.STARTING,val bootstrap:Bootstrap?=null,val message:String?=null,val submitting:Boolean=false)

class MainViewModel(app:Application):AndroidViewModel(app){
 private val session=SecureSession(app);private val api=ApiClient(session);private val _state=MutableStateFlow(AppState());val state:StateFlow<AppState> = _state
 init{if(session.token()==null)_state.value=AppState(AppStatus.SIGNED_OUT)else validateSession()}
 fun login(email:String,password:String){if(_state.value.submitting)return;viewModelScope.launch{_state.value=AppState(AppStatus.SIGNED_OUT,submitting=true);try{_state.value=AppState(AppStatus.AUTHENTICATED,api.login(email.trim(),password))}catch(e:Exception){if(e is ForbiddenMobileRoleException)session.clear();_state.value=AppState(AppStatus.SIGNED_OUT,message=loginMessage(e))}}}
 fun validateSession()=viewModelScope.launch{_state.value=_state.value.copy(status=AppStatus.STARTING,message=null);try{_state.value=AppState(AppStatus.AUTHENTICATED,api.bootstrap())}catch(e:Exception){when(e){is IOException->_state.value=AppState(AppStatus.RECOVERABLE_ERROR,message="You're offline. Reconnect and try again.");is ForbiddenMobileRoleException->{session.clear();TrackingService.stop(getApplication());_state.value=AppState(AppStatus.SIGNED_OUT,message="Super Admin accounts are available on the web only.")};is ApiException->{session.clear();TrackingService.stop(getApplication());_state.value=AppState(AppStatus.SIGNED_OUT,message="Your session expired. Please sign in again.")};else->_state.value=AppState(AppStatus.RECOVERABLE_ERROR,message="We couldn't validate your session. Please try again.")}}}
 fun attendance(start:Boolean,onSuccess:()->Unit)=viewModelScope.launch{try{api.attendance(if(start)"START" else "END",null);val refreshed=api.bootstrap();_state.value=AppState(AppStatus.AUTHENTICATED,refreshed);onSuccess()}catch(_:Exception){_state.value=_state.value.copy(message="Attendance action could not be completed. Check your connection and try again.")}}
 fun clearMessage(){_state.value=_state.value.copy(message=null)}
 fun logout()=viewModelScope.launch{TrackingService.stop(getApplication());try{api.logout()}finally{session.clear();_state.value=AppState(AppStatus.SIGNED_OUT)}}
 private fun loginMessage(e:Exception)=when{e is ForbiddenMobileRoleException->"Super Admin accounts are available on the web only.";e is IOException->"You're offline. Check your connection and try again.";e is ApiException&&e.status==429->"Too many sign-in attempts. Please wait and try again.";e is ApiException&&e.status in listOf(400,401,403)->"Email or password is incorrect.";else->"Unable to sign in right now. Please try again."}
}
