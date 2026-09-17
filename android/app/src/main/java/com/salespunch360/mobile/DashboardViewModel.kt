package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.DashboardEmployee
import com.salespunch360.mobile.data.LatestLocation
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardTrackingState(val loading:Boolean=false,val employees:List<DashboardEmployee> = emptyList(),val selectedEmployeeId:String?=null,val latestLocation:LatestLocation?=null,val message:String?=null)

class DashboardViewModel(application:Application):AndroidViewModel(application){
 private val api=ApiClient(SecureSession(application));private val _state=MutableStateFlow(DashboardTrackingState());val state:StateFlow<DashboardTrackingState> = _state.asStateFlow()
 fun load(){viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);runCatching{api.dashboard()}.onSuccess{result->_state.value=DashboardTrackingState(employees=result.employees)}.onFailure{_state.value=_state.value.copy(loading=false,message="Unable to load authorized employees.")}}}
 fun select(employeeId:String){_state.value=_state.value.copy(selectedEmployeeId=employeeId,latestLocation=null,message=null)}
 fun view(){val id=_state.value.selectedEmployeeId?:return;viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);runCatching{api.dashboard(id)}.onSuccess{result->_state.value=_state.value.copy(loading=false,employees=result.employees,selectedEmployeeId=result.liveUserId,latestLocation=result.latestLocation,message=if(result.latestLocation==null)"No stored GPS location is available for this employee." else null)}.onFailure{_state.value=_state.value.copy(loading=false,message="Unable to load live tracking location.")}}}
}
