package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.MobileRouteSignal
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class LeadsState(
 val loading:Boolean=true,val leads:List<LeadSummary> = emptyList(),val page:Int=1,val hasMore:Boolean=false,val stage:LeadStage?=null,
 val pending:PendingLeadsContext=PendingLeadsContext(),val pendingPage:Int=1,val pendingHasMore:Boolean=false,val pendingLoading:Boolean=false,
 val options:List<DashboardEmployee> = emptyList(),val telecallers:List<TelecallerOption> = emptyList(),
 val query:String="",val employeeId:String?=null,val callCounts:Map<String,Int> = emptyMap(),val detail:LeadSummary?=null,
 val detailFollowUps:List<FollowUpTask> = emptyList(),val detailFollowUpPage:Int=1,val detailHasMore:Boolean=false,
 val detailCallHistory:List<LeadCallHistoryItem> = emptyList(),val detailLoading:Boolean=false,val busy:Boolean=false,val message:String?=null,
)
class LeadsViewModel(app:Application):AndroidViewModel(app){
 private val session=SecureSession(app);private val api=ApiClient(session);private val pendingClient=PendingLeadsClient(session);private val telecalling=TelecallingClient(session);private val followUpMutations=FollowUpMutationClient(session)
 private val _state=MutableStateFlow(LeadsState());val state:StateFlow<LeadsState> = _state
 private var readJob:Job?=null;private var pendingJob:Job?=null;private var detailJob:Job?=null;private var requestedDetail:String?=null;private var initialized=false
 init{viewModelScope.launch{MobileRouteSignal.current.collect{if(it=="Leads"&&!initialized){initialized=true;refresh()}}}}
 fun setQuery(value:String){_state.value=_state.value.copy(query=value.take(100))}
 fun setEmployee(value:String?){_state.value=_state.value.copy(employeeId=value)}
 fun selectStage(value:LeadStage?){_state.value=_state.value.copy(stage=value);refresh()}
 fun refresh(q:String=_state.value.query,employee:String?=_state.value.employeeId,savedNotice:String?=null){
  readJob?.cancel();pendingJob?.cancel();_state.value=_state.value.copy(loading=true,query=q,employeeId=employee,pendingLoading=true)
  val stage=_state.value.stage
  readJob=viewModelScope.launch{try{
   coroutineScope{
    val page=async{api.leadsPage(q,employee,stage=stage)}
    val pending=async{pendingClient.page(1,q,employee)}
    val options=async{if(_state.value.options.isEmpty())api.leadOptions() else _state.value.options}
    val callers=async{if(_state.value.telecallers.isEmpty())optional(emptyList<TelecallerOption>()){followUpMutations.telecallers()} else _state.value.telecallers}
    val counts=async{optional(_state.value.callCounts){telecalling.queue().associate{it.id to it.calls}}}
    val result=page.await();val pendingResult=pending.await()
    _state.value=_state.value.copy(loading=false,leads=result.leads,page=result.page,hasMore=result.hasMore,pending=PendingLeadsContext(pendingResult.count,pendingResult.visits),pendingPage=pendingResult.page,pendingHasMore=pendingResult.hasMore,pendingLoading=false,options=options.await(),telecallers=callers.await(),callCounts=counts.await())
   }
  }catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(loading=false,pendingLoading=false,message=savedNotice?.let{"$it Refresh pending. Tap Search to refresh."}?:apiMessage(e,"Leads couldn't be loaded."))}}
 }
 fun more(){if(_state.value.loading||!_state.value.hasMore)return;val current=_state.value;readJob?.cancel();_state.value=current.copy(loading=true);readJob=viewModelScope.launch{try{val result=api.leadsPage(current.query,current.employeeId,current.page+1,current.stage);_state.value=_state.value.copy(loading=false,leads=(current.leads+result.leads).distinctBy{it.id},page=result.page,hasMore=result.hasMore)}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(loading=false,message=apiMessage(e,"More leads couldn't be loaded."))}}}
 fun morePending(){val current=_state.value;if(current.pendingLoading||!current.pendingHasMore)return;pendingJob?.cancel();_state.value=current.copy(pendingLoading=true);pendingJob=viewModelScope.launch{try{val result=pendingClient.page(current.pendingPage+1,current.query,current.employeeId);_state.value=_state.value.copy(pending=PendingLeadsContext(result.count,(current.pending.visits+result.visits).distinctBy{it.id}),pendingPage=result.page,pendingHasMore=result.hasMore,pendingLoading=false)}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(pendingLoading=false,message=apiMessage(e,"More pending visits couldn't be loaded."))}}}
 fun open(id:String){
  detailJob?.cancel();requestedDetail=id
  val cached=_state.value.detail?.takeIf{it.id==id}?:_state.value.leads.firstOrNull{it.id==id}
  _state.value=_state.value.copy(detail=cached,detailLoading=cached==null,detailFollowUps=emptyList(),detailCallHistory=emptyList(),detailHasMore=false)
  detailJob=viewModelScope.launch{try{
   val detail=api.lead(id);if(requestedDetail!=id)return@launch
   _state.value=_state.value.copy(detail=detail,detailLoading=false)
   coroutineScope{
    val tasks=async{api.followUps("ALL",leadId=id)}
    val history=async{optional(emptyList<LeadCallHistoryItem>()){telecalling.history(id)}}
    val follow=tasks.await();val calls=history.await();if(requestedDetail==id)_state.value=_state.value.copy(detailFollowUps=follow.tasks,detailFollowUpPage=follow.page,detailHasMore=follow.hasMore,detailCallHistory=calls,callCounts=_state.value.callCounts+(id to calls.size))
   }
  }catch(e:CancellationException){throw e}catch(e:Exception){if(requestedDetail==id)_state.value=_state.value.copy(detailLoading=false,message=apiMessage(e,"Lead details couldn't be loaded."))}}
 }
 fun moreHistory(){val id=requestedDetail?:return;if(!_state.value.detailHasMore)return;detailJob?.cancel();detailJob=viewModelScope.launch{try{val result=api.followUps("ALL",leadId=id,page=_state.value.detailFollowUpPage+1);if(requestedDetail==id)_state.value=_state.value.copy(detailFollowUps=(_state.value.detailFollowUps+result.tasks).distinctBy{it.id},detailFollowUpPage=result.page,detailHasMore=result.hasMore)}catch(e:CancellationException){throw e}catch(e:Exception){if(requestedDetail==id)_state.value=_state.value.copy(message=apiMessage(e,"History couldn't be loaded."))}}}
 fun close(){requestedDetail=null;detailJob?.cancel();_state.value=_state.value.copy(detail=null,detailLoading=false,detailFollowUps=emptyList(),detailCallHistory=emptyList(),message=null)}
 fun transition(lead:LeadSummary,stage:LeadStage,reason:String?){mutate("Lead updated."){api.transitionLead(lead.id,lead.version,stage,reason)}}
 fun followUp(lead:LeadSummary,dueDate:String,notes:String?,type:String,assignedUserId:String?=null){mutate("${if(type=="CALL") "Call" else "Visit"} follow-up added successfully."){followUpMutations.create(lead.id,dueDate,type,notes,assignedUserId)}}
 fun recordCall(lead:LeadSummary,result:String,notes:String?,nextCallbackAt:String?,dialStartedAt:String?=null,dialEndedAt:String?=null,timingSource:String?=null){mutate("Call result saved."){telecalling.recordCall(lead.id,result,notes,nextCallbackAt,dialStartedAt=dialStartedAt,dialEndedAt=dialEndedAt,timingSource=timingSource)}}
 fun edit(request:LeadEditRequest,onSaved:()->Unit={}){mutate("Lead updated.",onSaved){val saved=api.editLead(request);if(requestedDetail==saved.id)_state.value=_state.value.copy(detail=saved);_state.value=_state.value.copy(leads=_state.value.leads.map{if(it.id==saved.id)saved else it})}}
 fun delete(lead:LeadSummary){mutate("Lead deleted.",{close()}){api.deleteLead(lead.id)}}
 fun addPendingPhone(visit:PendingLeadVisit,phone:String){mutate("Phone added. Lead created."){api.addPendingPhone(visit.id,phone)}}
 fun clear(){_state.value=_state.value.copy(message=null)}
 private fun mutate(success:String,onSaved:()->Unit={},action:suspend()->Any){
  if(_state.value.busy)return
  _state.value=_state.value.copy(busy=true,message=null)
  viewModelScope.launch{
   try{action()}catch(e:CancellationException){_state.value=_state.value.copy(busy=false);throw e}catch(e:Exception){_state.value=_state.value.copy(busy=false,message=if(e is ApiException&&e.code=="STALE")"This lead changed elsewhere. Your draft is kept here. Reload the latest version and review your changes." else apiMessage(e,"Could not confirm this change. Refresh before trying again."));return@launch}
   _state.value=_state.value.copy(busy=false,message=success);onSaved()
   refresh(savedNotice=success);requestedDetail?.let{open(it)}
   delay(2500);if(_state.value.message==success)_state.value=_state.value.copy(message=null)
  }
 }
 private suspend fun <T> optional(fallback:T,load:suspend()->T):T=try{load()}catch(e:CancellationException){throw e}catch(_:Exception){fallback}
}
