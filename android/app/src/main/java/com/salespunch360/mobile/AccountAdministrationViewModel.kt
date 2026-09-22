package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
data class AdministrationState(val mode:String="settings",val loading:Boolean=false,val data:JsonElement=JsonObject(emptyMap()),val error:String?=null,val message:String?=null)
class AccountAdministrationViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(app);private val _state=MutableStateFlow(AdministrationState());val state=_state.asStateFlow();fun load(mode:String){_state.value=_state.value.copy(mode=mode,loading=true,error=null);viewModelScope.launch{runCatching{when(mode){"settings","custom-fields","modules","print-templates"->api.accountAdministration("settings");"notifications"->api.accountAdministration("notifications");"tax-settings"->api.accountTax();"tax-reports"->api.accountTax(mapOf("from" to java.time.LocalDate.now().withDayOfYear(1).toString(),"to" to java.time.LocalDate.now().toString()));else->api.accountUtility(mode)}}.onSuccess{_state.value=_state.value.copy(loading=false,data=it)}.onFailure{_state.value=_state.value.copy(loading=false,error=it.message?:"Unable to load")}}}fun save(section:String,payload:JsonObject){_state.value=_state.value.copy(loading=true,error=null);viewModelScope.launch{runCatching{if(section.startsWith("tax"))api.saveAccountTax(payload)else api.saveAccountAdministration("settings",section,payload)}.onSuccess{_state.value=_state.value.copy(message="Saved on server");load(_state.value.mode)}.onFailure{_state.value=_state.value.copy(loading=false,error=it.message?:"Save failed")}}}}
