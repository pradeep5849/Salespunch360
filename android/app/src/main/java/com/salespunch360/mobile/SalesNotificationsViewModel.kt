package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
data class SalesNotificationsState(val loading:Boolean=false,val data:SalesNotificationsContext=SalesNotificationsContext(),val error:String?=null)
class SalesNotificationsViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(SalesNotificationsState());val state:StateFlow<SalesNotificationsState> = _state
 fun refresh(){viewModelScope.launch{_state.value=_state.value.copy(loading=true,error=null);runCatching{api.salesNotifications()}.onSuccess{_state.value=SalesNotificationsState(data=it)}.onFailure{_state.value=_state.value.copy(loading=false,error="Notifications could not be loaded.")}}}
 fun read(id:String?,after:(SalesNotification?)->Unit={}){val item=_state.value.data.items.firstOrNull{it.id==id};viewModelScope.launch{runCatching{api.readSalesNotification(id)}.onSuccess{refresh();after(item)}.onFailure{_state.value=_state.value.copy(error="Notification could not be updated.")}}}
 init{refresh()}}
