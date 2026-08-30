package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
data class LeadsState(val loading:Boolean=true,val leads:List<LeadSummary> = emptyList(),val busy:Boolean=false,val message:String?=null)
class LeadsViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(LeadsState());val state:StateFlow<LeadsState> = _state;init{refresh()};fun refresh()=viewModelScope.launch{_state.value=_state.value.copy(loading=true);_state.value=try{LeadsState(false,api.leads())}catch(_:Exception){_state.value.copy(loading=false,message="Leads couldn't be loaded.")}};fun transition(lead:LeadSummary,stage:LeadStage,reason:String?){mutate{api.transitionLead(lead.id,lead.version,stage,reason)}};fun followUp(lead:LeadSummary,at:String?,notes:String?){mutate{api.updateFollowUp(lead.id,at,notes)}};fun clear(){_state.value=_state.value.copy(message=null)};private fun mutate(action:suspend()->Unit){if(_state.value.busy)return;viewModelScope.launch{_state.value=_state.value.copy(busy=true);try{action();_state.value=LeadsState(false,api.leads(),message="Lead updated.")}catch(e:ApiException){_state.value=_state.value.copy(busy=false,message=if(e.code=="STALE")"This lead changed. Refresh and try again." else "Lead update wasn't accepted.")}}}}
