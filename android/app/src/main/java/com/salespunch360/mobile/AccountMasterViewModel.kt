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

data class AccountMasterState(val kind:String="",val loading:Boolean=false,val saving:Boolean=false,val query:String="",val active:String="true",val records:List<AccountMasterRecord> = emptyList(),val options:AccountMasterOptions=AccountMasterOptions(),val selected:AccountPartyDetail?=null,val editing:AccountMasterRecord?=null,val error:String?=null,val message:String?=null)
class AccountMasterViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(AccountMasterState());val state:StateFlow<AccountMasterState> = _state;private var loadJob:Job?=null
 fun open(kind:String){if(_state.value.kind==kind)return;_state.value=AccountMasterState(kind=kind);refresh()}
 fun search(query:String){_state.value=_state.value.copy(query=query);refresh()}
 fun filter(active:String){_state.value=_state.value.copy(active=active);refresh()}
 fun refresh(){val snapshot=_state.value;if(snapshot.kind.isBlank())return;loadJob?.cancel();loadJob=viewModelScope.launch{_state.value=_state.value.copy(loading=true,error=null);try{val options=if(_state.value.options.branches.isEmpty())api.accountMasterOptions() else _state.value.options;val records=api.accountMasterList(snapshot.kind,snapshot.query,snapshot.active);_state.value=_state.value.copy(loading=false,records=records,options=options)}catch(error:Exception){_state.value=_state.value.copy(loading=false,error=message(error))}}}
 fun detail(record:AccountMasterRecord)=viewModelScope.launch{if(_state.value.kind !in listOf("customers","vendors")){_state.value=_state.value.copy(editing=record);return@launch};_state.value=_state.value.copy(loading=true);try{_state.value=_state.value.copy(loading=false,selected=api.accountMasterDetail(_state.value.kind,record.id))}catch(error:Exception){_state.value=_state.value.copy(loading=false,error=message(error))}}
 fun edit(record:AccountMasterRecord?){_state.value=_state.value.copy(editing=record,selected=null,message=null,error=null)}
 fun closeDetail(){_state.value=_state.value.copy(selected=null)}
 fun save(payload:JsonObject)=viewModelScope.launch{_state.value=_state.value.copy(saving=true,error=null);try{api.saveAccountMaster(_state.value.kind,_state.value.editing?.id,payload);_state.value=_state.value.copy(saving=false,editing=null,message="Saved successfully.");refresh()}catch(error:Exception){_state.value=_state.value.copy(saving=false,error=if(error is ApiException&&error.code=="INVALID_INPUT")"Check the highlighted details and try again." else message(error))}}
 fun clearFeedback(){_state.value=_state.value.copy(error=null,message=null)}
 private fun message(error:Exception)=when{error is IOException->"You're offline. Reconnect and try again.";error is ApiException&&error.status==403->"You don't have permission for this Account action.";else->"Unable to load this data. Please try again."}
}
