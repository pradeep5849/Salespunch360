package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException

data class FollowUpsState(
    val loading:Boolean=true,
    val loadingMore:Boolean=false,
    val filter:String="TODAY",
    val tasks:List<FollowUpTask> = emptyList(),
    val employees:List<DashboardEmployee> = emptyList(),
    val employeeId:String?=null,
    val page:Int=1,
    val hasMore:Boolean=false,
    val message:String?=null,
    val busyTaskId:String?=null,
    val currentUserId:String?=null,
)
class FollowUpsViewModel(app:Application):AndroidViewModel(app){
 private val session=SecureSession(app);private val api=ApiClient(session);private val mutations=FollowUpMutationClient(session);private val _state=MutableStateFlow(FollowUpsState(currentUserId=session.userId()));val state:StateFlow<FollowUpsState> = _state
 init{refresh()}
 fun select(filter:String){if(filter==_state.value.filter)return;_state.value=_state.value.copy(filter=filter,page=1,hasMore=false,tasks=emptyList());refresh()}
 fun selectEmployee(employeeId:String?){if(employeeId==_state.value.employeeId)return;_state.value=_state.value.copy(employeeId=employeeId,page=1,hasMore=false,tasks=emptyList());refresh()}
 fun refresh()=viewModelScope.launch{val current=_state.value;_state.value=current.copy(loading=true,loadingMore=false,message=null,page=1,hasMore=false);_state.value=try{val result=api.followUps(current.filter,current.employeeId,page=1);current.copy(loading=false,loadingMore=false,filter=result.status,tasks=result.tasks,employees=result.employees,employeeId=result.employeeId,page=result.page,hasMore=result.hasMore)}catch(e:CancellationException){throw e}catch(e:Exception){current.copy(loading=false,loadingMore=false,message=apiMessage(e,"Follow-ups couldn't be loaded."))}}
 fun loadMore(){val current=_state.value;if(current.loading||current.loadingMore||!current.hasMore)return;_state.value=current.copy(loadingMore=true,message=null);viewModelScope.launch{try{val result=api.followUps(current.filter,current.employeeId,page=current.page+1);_state.value=_state.value.copy(loadingMore=false,tasks=(_state.value.tasks+result.tasks).distinctBy{it.id},page=result.page,hasMore=result.hasMore,employees=result.employees,employeeId=result.employeeId)}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(loadingMore=false,message=apiMessage(e,"More follow-ups couldn't be loaded."))}}}
 fun cancel(task:FollowUpTask)=viewModelScope.launch{_state.value=_state.value.copy(busyTaskId=task.id,message=null);try{api.cancelFollowUp(task.id);reload("Follow-up cancelled.")}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(busyTaskId=null,message=apiMessage(e,"Follow-up couldn't be cancelled."))}}
 fun completeCall(task:FollowUpTask,outcomeNote:String)=viewModelScope.launch{_state.value=_state.value.copy(busyTaskId=task.id,message=null);try{mutations.completeCall(task.id,outcomeNote.trim());reload("Call follow-up completed.")}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(busyTaskId=null,message=apiMessage(e,"Call follow-up couldn't be completed."))}}
 private suspend fun reload(message:String){_state.value=_state.value.copy(busyTaskId=null,message=message,page=1,hasMore=false);try{val result=api.followUps(_state.value.filter,_state.value.employeeId,page=1);_state.value=_state.value.copy(loading=false,loadingMore=false,filter=result.status,tasks=result.tasks,employees=result.employees,employeeId=result.employeeId,page=result.page,hasMore=result.hasMore,busyTaskId=null,message=message)}catch(e:CancellationException){throw e}catch(_:Exception){_state.value=_state.value.copy(message="$message Refresh pending.")}}
 fun clear(){_state.value=_state.value.copy(message=null)}
}
