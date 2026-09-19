package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardTrackingState(val loading:Boolean=false,val employees:List<DashboardEmployee> = emptyList(),val selectedEmployeeId:String?=null,val selectedCheckEmployeeId:String?=null,val latestLocation:LatestLocation?=null,val recentVisits:List<AdminDashboardVisit> = emptyList(),val gpsTrackingEnabled:Boolean?=null,val message:String?=null)

class DashboardViewModel(application:Application):AndroidViewModel(application){
 private val api=ApiClient(SecureSession(application));private val _state=MutableStateFlow(DashboardTrackingState());val state:StateFlow<DashboardTrackingState> = _state.asStateFlow()
 init{load()}
 fun load(checkEmployee:String?=_state.value.selectedCheckEmployeeId){if(_state.value.loading)return;viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);runCatching{api.dashboard(checkEmployee=checkEmployee)}.onSuccess{result->_state.value=DashboardTrackingState(loading=false,employees=result.employees,selectedEmployeeId=_state.value.selectedEmployeeId,selectedCheckEmployeeId=result.checkUserId,recentVisits=result.recentVisits,gpsTrackingEnabled=result.gpsTrackingEnabled)}.onFailure{_state.value=_state.value.copy(loading=false,message="Unable to load dashboard data.")}}}
 fun select(employeeId:String){_state.value=_state.value.copy(selectedEmployeeId=employeeId,latestLocation=null,message=null)}
 fun selectCheck(employeeId:String?){_state.value=_state.value.copy(selectedCheckEmployeeId=employeeId);load(employeeId)}
 fun view(){val id=_state.value.selectedEmployeeId?:return;if(_state.value.loading)return;viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);runCatching{api.dashboard(liveEmployee=id,checkEmployee=_state.value.selectedCheckEmployeeId)}.onSuccess{result->_state.value=_state.value.copy(loading=false,employees=result.employees,selectedEmployeeId=result.liveUserId,latestLocation=result.latestLocation,recentVisits=result.recentVisits,gpsTrackingEnabled=result.gpsTrackingEnabled,message=if(result.latestLocation==null)"No stored GPS location is available for this employee." else null)}.onFailure{_state.value=_state.value.copy(loading=false,message="Unable to load live tracking location.")}}}
}
