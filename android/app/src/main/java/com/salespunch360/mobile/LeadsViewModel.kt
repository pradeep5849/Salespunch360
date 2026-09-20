package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class LeadsState(val loading:Boolean=true,val leads:List<LeadSummary> = emptyList(),val pending:PendingLeadsContext=PendingLeadsContext(),val options:List<DashboardEmployee> = emptyList(),val query:String="",val employeeId:String?=null,val detail:LeadSummary?=null,val detailLoading:Boolean=false,val busy:Boolean=false,val message:String?=null)
class LeadsViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(LeadsState());val state:StateFlow<LeadsState> = _state
 init{refresh()}
 fun setQuery(value:String){_state.value=_state.value.copy(query=value.take(100))}
 fun setEmployee(value:String?){_state.value=_state.value.copy(employeeId=value)}
 fun refresh(q:String=_state.value.query,employee:String?=_state.value.employeeId)=viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);_state.value=try{_state.value.copy(loading=false,leads=api.leads(q,employee),pending=api.pendingLeads(),options=runCatching{api.leadOptions()}.getOrDefault(emptyList()),query=q,employeeId=employee)}catch(e:Exception){_state.value.copy(loading=false,message=apiMessage(e,"Leads couldn't be loaded."))}}
 fun open(id:String)=viewModelScope.launch{_state.value=_state.value.copy(detailLoading=true,detail=null);_state.value=try{_state.value.copy(detail=api.lead(id),detailLoading=false)}catch(e:Exception){_state.value.copy(detailLoading=false,message=apiMessage(e,"Lead details couldn't be loaded."))}}
 fun close(){_state.value=_state.value.copy(detail=null,detailLoading=false)}
 fun transition(lead:LeadSummary,stage:LeadStage,reason:String?){mutate{api.transitionLead(lead.id,lead.version,stage,reason)}}
 fun followUp(lead:LeadSummary,at:String?,notes:String?){mutate{api.updateFollowUp(lead.id,at,notes)}}
 fun edit(request:LeadEditRequest){if(_state.value.busy)return;viewModelScope.launch{_state.value=_state.value.copy(busy=true,message=null);try{val detail=api.editLead(request);_state.value=_state.value.copy(busy=false,detail=detail,message="Lead updated.");val list=api.leads(_state.value.query,_state.value.employeeId);_state.value=_state.value.copy(leads=list)}catch(e:Exception){_state.value=_state.value.copy(busy=false,message=apiMessage(e,"Lead update wasn't accepted."))}}}
 fun delete(lead:LeadSummary){mutate{api.deleteLead(lead.id)}}
 fun addPendingPhone(visit:PendingLeadVisit,phone:String){mutate("Phone added. Lead created."){api.addPendingPhone(visit.id,phone)}}
 fun clear(){_state.value=_state.value.copy(message=null)}
 private fun mutate(success:String="Lead updated.",action:suspend()->Unit){if(_state.value.busy)return;viewModelScope.launch{_state.value=_state.value.copy(busy=true);try{action();_state.value=_state.value.copy(loading=false,busy=false,leads=api.leads(_state.value.query,_state.value.employeeId),pending=api.pendingLeads(),detail=null,message=success)}catch(e:Exception){_state.value=_state.value.copy(busy=false,message=apiMessage(e,"Lead update wasn't accepted."))}}}
}
