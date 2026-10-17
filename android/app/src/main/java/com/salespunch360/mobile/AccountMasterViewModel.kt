package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

data class AccountMasterState(val createdBranchId:String?=null,val kind:String="",val loading:Boolean=false,val saving:Boolean=false,val query:String="",val active:String="true",val records:List<AccountMasterRecord> = emptyList(),val options:AccountMasterOptions=AccountMasterOptions(),val selected:AccountPartyDetail?=null,val editing:AccountMasterRecord?=null,val error:String?=null,val message:String?=null,val createdRecord:AccountMasterRecord?=null)
class AccountMasterViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(AccountMasterState());val state:StateFlow<AccountMasterState> = _state;private var loadJob:Job?=null;private var loadGeneration=0L;private var pendingCreate=false;private var pendingBranch:String?=null
 fun open(kind:String){if(_state.value.kind==kind)return;_state.value=AccountMasterState(kind=kind);refresh()}
 fun search(query:String){_state.value=_state.value.copy(query=query);refresh()}
 fun filter(active:String){_state.value=_state.value.copy(active=active);refresh()}
 fun beginCreate(branchId:String?){if(_state.value.saving)return;pendingCreate=true;pendingBranch=branchId;_state.value=_state.value.copy(options=AccountMasterOptions(),editing=null,createdBranchId=null,createdRecord=null,message=null);refresh()}
 fun refresh(){
  val snapshot=_state.value;if(snapshot.kind.isBlank())return
  loadJob?.cancel();val generation=++loadGeneration
  loadJob=viewModelScope.launch{
   _state.value=_state.value.copy(loading=true,error=null)
   try{
    val options=if(snapshot.options.branches.isEmpty())api.accountMasterOptions(snapshot.kind)else snapshot.options
    val records=if(pendingCreate)emptyList()else api.accountMasterList(snapshot.kind,snapshot.query,snapshot.active)
    if(generation!=loadGeneration)return@launch
    _state.value=_state.value.copy(loading=false,records=records,options=options)
    if(pendingCreate){
     val branch=pendingBranch?:options.branches.firstOrNull()?.id
     if(snapshot.kind=="customers"&&(branch==null||options.branches.none{it.id==branch})){
      _state.value=_state.value.copy(error="That branch is unavailable. Return to Home and refresh your branch choices.")
     }else{pendingCreate=false;edit(AccountMasterRecord(id="",name="",branchId=branch))}
    }
   }catch(error:kotlinx.coroutines.CancellationException){throw error}catch(error:Exception){if(generation==loadGeneration)_state.value=_state.value.copy(loading=false,error=message(error))}
  }
 }
 fun detail(record:AccountMasterRecord)=viewModelScope.launch{if(_state.value.kind !in listOf("customers","vendors")){_state.value=_state.value.copy(editing=record);return@launch};_state.value=_state.value.copy(loading=true);try{_state.value=_state.value.copy(loading=false,selected=api.accountMasterDetail(_state.value.kind,record.id))}catch(error:Exception){_state.value=_state.value.copy(loading=false,error=message(error))}}
 fun edit(record:AccountMasterRecord?){if(_state.value.saving)return;_state.value=_state.value.copy(editing=record,selected=null,message=null,error=null)}
 fun closeDetail(){_state.value=_state.value.copy(selected=null)}
 fun save(payload:JsonObject)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{val creating=_state.value.editing?.id.isNullOrBlank();val saved=api.saveAccountMaster(_state.value.kind,_state.value.editing?.id,payload);_state.value=_state.value.copy(saving=false,editing=null,createdRecord=if(creating)saved else null,createdBranchId=if(creating)saved.branchId?:payload["branchId"]?.jsonPrimitive?.contentOrNull else null,message="Saved successfully.");refresh()}catch(error:Exception){_state.value=_state.value.copy(saving=false,error=if(error is ApiException&&error.code=="INVALID_INPUT")"Check the entered details and try again. Your inputs were kept." else message(error))}}
 fun clearFeedback(){_state.value=_state.value.copy(error=null,message=null)}
 private fun message(error:Exception)=when{error is IOException->"You're offline. Reconnect and try again.";error is ApiException&&error.status==403->"You don't have permission for this Account action.";else->"Unable to load this data. Please try again."}
}
