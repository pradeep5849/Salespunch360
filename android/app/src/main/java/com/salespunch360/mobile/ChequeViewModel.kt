package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.account.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*

data class ChequeState(val loading:Boolean=false,val saving:Boolean=false,val canClose:Boolean=false,val canCorrect:Boolean=false,val optionsLoading:Boolean=false,val partiesLoading:Boolean=false,val entryOptions:JsonObject=JsonObject(emptyMap()),val parties:List<JsonObject> = emptyList(),val partiesMore:Boolean=false,val q:String="",val tab:String="OPEN",val order:String="desc",val rows:List<JsonObject> = emptyList(),val total:Int=0,val nextOffset:Int?=null,val error:String?=null)
class ChequeViewModel(app:Application):AndroidViewModel(app) {
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ChequeState());val state:StateFlow<ChequeState> = _state
 private var contextQuery="";private var loadJob:Job?=null;private var generation=0
 fun context(query:String){contextQuery=query;clearEntryOptions();clearParties();load()}
 fun search(value:String){if(value.length>160)return;_state.value=_state.value.copy(q=value);load(debounce=true)}
 fun tab(value:String){_state.value=_state.value.copy(tab=value);load()}
 fun sort(){_state.value=_state.value.copy(order=if(_state.value.order=="desc")"asc"else "desc");load()}
 fun refresh(){load()}
 fun more(){if(!_state.value.loading&&_state.value.nextOffset!=null)load(append=true)}
 private var optionsGeneration=0;private var partyGeneration=0
 fun clearEntryOptions(){optionsGeneration++;_state.value=_state.value.copy(optionsLoading=false,entryOptions=JsonObject(emptyMap()))}
 fun entryOptions(branchId:String="",kind:String="BANK",offset:Int=0){val ticket=++optionsGeneration;_state.value=_state.value.copy(optionsLoading=true,error=null,entryOptions=JsonObject(emptyMap()));viewModelScope.launch{try{val options=api.chequeEntryOptions(branchId.ifBlank{android.net.Uri.parse("https://local.invalid/?$contextQuery").getQueryParameter("branchId").orEmpty()},kind,offset);if(ticket==optionsGeneration)_state.value=_state.value.copy(optionsLoading=false,entryOptions=options)}catch(e:CancellationException){throw e}catch(e:Exception){if(ticket==optionsGeneration)_state.value=_state.value.copy(optionsLoading=false,error="Cheque accounts could not be loaded. Retry.")}}}
 fun clearParties(){partyGeneration++;_state.value=_state.value.copy(partiesLoading=false,parties=emptyList(),partiesMore=false)}
 fun parties(branchId:String,direction:String,q:String,offset:Int=0){val ticket=++partyGeneration;_state.value=_state.value.copy(partiesLoading=true,error=null,parties=emptyList(),partiesMore=false);viewModelScope.launch{try{val result=api.chequeParties(branchId,direction,q,offset);if(ticket==partyGeneration)_state.value=_state.value.copy(partiesLoading=false,parties=result["rows"]?.jsonArray?.map{it.jsonObject}.orEmpty(),partiesMore=result["hasMore"]?.jsonPrimitive?.booleanOrNull==true)}catch(e:CancellationException){throw e}catch(e:Exception){if(ticket==partyGeneration)_state.value=_state.value.copy(partiesLoading=false,error="Parties could not be loaded. Retry.")}}}
 fun record(payload:JsonObject,legacyId:String?=null,onSuccess:()->Unit){if(_state.value.saving)return;_state.value=_state.value.copy(saving=true,error=null);viewModelScope.launch{try{if(legacyId==null)api.createCheque(payload)else api.completeChequeSource(legacyId,payload);_state.value=_state.value.copy(saving=false);onSuccess();refresh()}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(saving=false,error=(e as? ApiException)?.serverMessage ?: "Cheque could not be saved. Refresh and retry.")}}}
 fun action(row:JsonObject,action:String,date:String,reason:String,requestKey:String,moneyAccountId:String?=null,description:String="",onSuccess:()->Unit){
  if(_state.value.saving)return
  _state.value=_state.value.copy(saving=true,error=null)
  viewModelScope.launch{try{
   api.chequeFinancialAction(row.str("id"),chequeActionPayload(row,action,date,reason,requestKey,moneyAccountId,description))
   _state.value=_state.value.copy(saving=false);onSuccess();refresh()
  }catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(saving=false,error=(e as? ApiException)?.serverMessage ?: "Cheque could not be updated. Refresh and retry.")}}
 }
 private fun load(debounce:Boolean=false,append:Boolean=false){
  loadJob?.cancel();val snapshot=_state.value;val offset=if(append)snapshot.nextOffset?:return else 0;val ticket=++generation;val query=contextQuery
  _state.value=_state.value.copy(loading=true,error=null,canClose=if(append)snapshot.canClose else false,canCorrect=if(append)snapshot.canCorrect else false,rows=if(append)snapshot.rows else emptyList(),total=if(append)snapshot.total else 0,nextOffset=if(append)snapshot.nextOffset else null)
  loadJob=viewModelScope.launch{try{
   if(debounce)delay(250)
   val data=api.chequePage(snapshot.q,snapshot.tab,snapshot.order,offset,query)
   if(ticket!=generation)return@launch
   val rows=data["rows"]?.jsonArray?.map{it.jsonObject}.orEmpty()
   _state.value=_state.value.copy(loading=false,canClose=data["canClose"]?.jsonPrimitive?.booleanOrNull==true,canCorrect=data["canCorrect"]?.jsonPrimitive?.booleanOrNull==true,rows=if(append)(snapshot.rows+rows).distinctBy{it.str("id")}else rows,total=data["total"]!!.jsonPrimitive.int,nextOffset=data["nextOffset"]?.jsonPrimitive?.intOrNull,error=null)
  }catch(e:CancellationException){throw e}catch(e:Exception){if(ticket==generation){val denied=e is ApiException&&e.status==403;_state.value=_state.value.copy(loading=false,rows=if(denied)emptyList()else _state.value.rows,total=if(denied)0 else _state.value.total,nextOffset=if(denied)null else _state.value.nextOffset,error=when{denied->"Your permission or branch access does not allow this view.";e is ApiException&&e.status==400->"Check the selected cheque filters and try again.";else->"Cheques could not be loaded. Retry."})}}}
 }
}
