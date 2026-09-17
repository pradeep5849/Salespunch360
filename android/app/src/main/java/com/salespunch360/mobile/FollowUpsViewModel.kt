package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class FollowUpsState(val loading:Boolean=true,val filter:String="TODAY",val tasks:List<FollowUpTask> = emptyList(),val message:String?=null)
class FollowUpsViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(FollowUpsState());val state:StateFlow<FollowUpsState> = _state
 init{refresh()}
 fun select(filter:String){if(filter==_state.value.filter)return;_state.value=_state.value.copy(filter=filter);refresh()}
 fun refresh()=viewModelScope.launch{val filter=_state.value.filter;_state.value=_state.value.copy(loading=true,message=null);_state.value=try{val result=api.followUps(filter);FollowUpsState(false,result.status,result.tasks)}catch(e:Exception){_state.value.copy(loading=false,message=apiMessage(e,"Follow-ups couldn't be loaded."))}}
 fun clear(){_state.value=_state.value.copy(message=null)}
}
