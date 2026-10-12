package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.account.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*

data class ChequeState(val loading:Boolean=false,val saving:Boolean=false,val canClose:Boolean=false,val canCorrect:Boolean=false,val q:String="",val tab:String="OPEN",val order:String="desc",val rows:List<JsonObject> = emptyList(),val total:Int=0,val nextOffset:Int?=null,val error:String?=null)
class ChequeViewModel(app:Application):AndroidViewModel(app) {
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ChequeState());val state:StateFlow<ChequeState> = _state
 private var contextQuery="";private var loadJob:Job?=null;private var generation=0
 fun context(query:String){contextQuery=query;load()}
 fun search(value:String){if(value.length>160)return;_state.value=_state.value.copy(q=value);load(debounce=true)}
 fun tab(value:String){_state.value=_state.value.copy(tab=value);load()}
 fun sort(){_state.value=_state.value.copy(order=if(_state.value.order=="desc")"asc"else "desc");load()}
 fun refresh(){load()}
 fun more(){if(!_state.value.loading&&_state.value.nextOffset!=null)load(append=true)}
 fun action(row:JsonObject,action:String,date:String,reason:String,requestKey:String,onSuccess:()->Unit){
  if(_state.value.saving)return
  _state.value=_state.value.copy(saving=true,error=null)
  viewModelScope.launch{try{
   api.chequeFinancialAction(row.str("id"),buildJsonObject{put("action",action);put("actionDate",date);put("requestKey",requestKey);put("expectedVersion",row["actionVersion"]?.jsonPrimitive?.intOrNull?:0);if(action=="CLOSE")put("moneyAccountId",row.str("moneyAccountId"))else put("reason",reason.trim())})
   _state.value=_state.value.copy(saving=false);onSuccess();refresh()
  }catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(saving=false,error=(e as? ApiException)?.serverMessage ?: "Cheque could not be updated. Refresh and retry.")}}
 }
 private fun load(debounce:Boolean=false,append:Boolean=false){
  loadJob?.cancel();val snapshot=_state.value;val offset=if(append)snapshot.nextOffset?:return else 0;val ticket=++generation;val query=contextQuery
  _state.value=_state.value.copy(loading=true,error=null,rows=if(append)snapshot.rows else emptyList(),total=if(append)snapshot.total else 0,nextOffset=if(append)snapshot.nextOffset else null)
  loadJob=viewModelScope.launch{try{
   if(debounce)delay(250)
   val data=api.chequePage(snapshot.q,snapshot.tab,snapshot.order,offset,query)
   if(ticket!=generation)return@launch
   val rows=data["rows"]?.jsonArray?.map{it.jsonObject}.orEmpty()
   _state.value=_state.value.copy(loading=false,canClose=data["canClose"]?.jsonPrimitive?.booleanOrNull==true,canCorrect=data["canCorrect"]?.jsonPrimitive?.booleanOrNull==true,rows=if(append)(snapshot.rows+rows).distinctBy{it.str("id")}else rows,total=data["total"]!!.jsonPrimitive.int,nextOffset=data["nextOffset"]?.jsonPrimitive?.intOrNull,error=null)
  }catch(e:CancellationException){throw e}catch(e:Exception){if(ticket==generation){val denied=e is ApiException&&e.status==403;_state.value=_state.value.copy(loading=false,rows=if(denied)emptyList()else _state.value.rows,total=if(denied)0 else _state.value.total,nextOffset=if(denied)null else _state.value.nextOffset,error=when{denied->"Your permission or branch access does not allow this view.";e is ApiException&&e.status==400->"Check the selected cheque filters and try again.";else->"Cheques could not be loaded. Retry."})}}}
 }
}
