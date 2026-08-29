package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.location.TrackingService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
data class AppState(val loading:Boolean=true,val bootstrap:Bootstrap?=null,val error:String?=null)
class MainViewModel(app:Application):AndroidViewModel(app){private val session=SecureSession(app);private val api=ApiClient(session);private val _state=MutableStateFlow(AppState());val state:StateFlow<AppState> = _state
 init{if(session.token()==null)_state.value=AppState(false)else bootstrap()}
 fun login(identifier:String,password:String)=viewModelScope.launch{_state.value=AppState(true);_state.value=runCatching{AppState(false,api.login(identifier,password))}.getOrElse{AppState(false,error="Unable to sign in. Check your details and try again.")}}
 fun bootstrap()=viewModelScope.launch{_state.value=runCatching{AppState(false,api.bootstrap())}.getOrElse{session.clear();TrackingService.stop(getApplication());AppState(false,error="Session expired. Please sign in again.")}}
 fun attendance(start:Boolean,onDone:()->Unit)=viewModelScope.launch{runCatching{api.attendance(if(start)"START" else "END",null);bootstrap();onDone()}.onFailure{_state.value=_state.value.copy(error="Attendance action could not be completed.")}}
 fun logout()=viewModelScope.launch{TrackingService.stop(getApplication());api.logout();_state.value=AppState(false)} }
