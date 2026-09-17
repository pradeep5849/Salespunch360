package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.data.TeamAttendanceEmployee
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AttendanceOverviewState(val loading:Boolean=false,val employees:List<TeamAttendanceEmployee> = emptyList(),val message:String?=null)

class AttendanceOverviewViewModel(application:Application):AndroidViewModel(application){
 private val api=ApiClient(SecureSession(application))
 private val _state=MutableStateFlow(AttendanceOverviewState())
 val state:StateFlow<AttendanceOverviewState> = _state.asStateFlow()
 init{load()}
 fun load(){viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);runCatching{api.attendanceOverview()}.onSuccess{_state.value=AttendanceOverviewState(employees=it.employees)}.onFailure{_state.value=_state.value.copy(loading=false,message="Unable to load team attendance.")}}}
}
