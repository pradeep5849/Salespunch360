package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class FollowUpsState(val loading:Boolean=true,val filter:String="TODAY",val tasks:List<FollowUpTask> = emptyList(),val employees:List<DashboardEmployee> = emptyList(),val employeeId:String?=null,val message:String?=null,val busyTaskId:String?=null,val currentUserId:String?=null)
class FollowUpsViewModel(app:Application):AndroidViewModel(app){
 private val session=SecureSession(app);private val api=ApiClient(session);private val mutations=FollowUpMutationClient(session);private val _state=MutableStateFlow(FollowUpsState(currentUserId=session.userId()));val state:StateFlow<FollowUpsState> = _state
 init{refresh()}
 fun select(filter:String){if(filter==_state.value.filter)return;_state.value=_state.value.copy(filter=filter);refresh()}
 fun selectEmployee(employeeId:String?){if(employeeId==_state.value.employeeId)return;_state.value=_state.value.copy(employeeId=employeeId);refresh()}
 fun refresh()=viewModelScope.launch{val current=_state.value;_state.value=current.copy(loading=true,message=null);_state.value=try{val result=api.followUps(current.filter,current.employeeId);current.copy(loading=false,filter=result.status,tasks=result.tasks,employees=result.employees,employeeId=result.employeeId)}catch(e:Exception){current.copy(loading=false,message=apiMessage(e,"Follow-ups couldn't be loaded."))}}
 fun cancel(task:FollowUpTask)=viewModelScope.launch{_state.value=_state.value.copy(busyTaskId=task.id,message=null);try{api.cancelFollowUp(task.id);reload("Follow-up cancelled.")}catch(e:Exception){_state.value=_state.value.copy(busyTaskId=null,message=apiMessage(e,"Follow-up couldn't be cancelled."))}}
 fun completeCall(task:FollowUpTask,outcomeNote:String)=viewModelScope.launch{_state.value=_state.value.copy(busyTaskId=task.id,message=null);try{mutations.completeCall(task.id,outcomeNote.trim());reload("Call follow-up completed.")}catch(e:Exception){_state.value=_state.value.copy(busyTaskId=null,message=apiMessage(e,"Call follow-up couldn't be completed."))}}
 private suspend fun reload(message:String){val result=api.followUps(_state.value.filter,_state.value.employeeId);_state.value=_state.value.copy(loading=false,filter=result.status,tasks=result.tasks,employees=result.employees,employeeId=result.employeeId,busyTaskId=null,message=message)}
 fun clear(){_state.value=_state.value.copy(message=null)}
}
