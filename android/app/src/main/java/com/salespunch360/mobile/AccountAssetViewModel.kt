package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*

data class AssetState(val hasMore:Boolean=false,val loading:Boolean=false,val saving:Boolean=false,val query:String="",val status:String?=null,val rows:List<JsonObject> = emptyList(),val options:JsonObject=buildJsonObject{},val detail:JsonObject?=null,val editing:JsonObject?=null,val error:String?=null,val message:String?=null)
class AccountAssetViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app))
 private val _state=MutableStateFlow(AssetState())
 val state:StateFlow<AssetState> = _state
 private var loadJob:Job?=null
 private var detailJob:Job?=null
 init{load()}
 fun refresh(){_state.value=_state.value.copy(options=buildJsonObject{});load()}
 fun load(){loadJob?.cancel();loadJob=viewModelScope.launch{fetch()}}
 private suspend fun fetch(){
  _state.value=_state.value.copy(loading=true,error=null)
  try{
   val options=if(_state.value.options.isEmpty())api.assetOptions() else _state.value.options
   val page=api.assetsPage(_state.value.query,_state.value.status)
   val rows=page.array("items").map{it.jsonObject}
   currentCoroutineContext().ensureActive()
   _state.value=_state.value.copy(loading=false,options=options,rows=rows,hasMore=page["hasMore"]?.jsonPrimitive?.booleanOrNull==true)
  }catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}
 }
 fun more(){if(_state.value.loading||!_state.value.hasMore)return;loadJob?.cancel();loadJob=viewModelScope.launch{_state.value=_state.value.copy(loading=true);try{val page=api.assetsPage(_state.value.query,_state.value.status,_state.value.rows.size);currentCoroutineContext().ensureActive();_state.value=_state.value.copy(loading=false,rows=(_state.value.rows+page.array("items").map{it.jsonObject}).distinctBy{it.str("id")},hasMore=page["hasMore"]?.jsonPrimitive?.booleanOrNull==true)}catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}}}
 fun search(q:String){_state.value=_state.value.copy(query=q);loadJob?.cancel();loadJob=viewModelScope.launch{delay(250);fetch()}}
 fun filter(s:String?){_state.value=_state.value.copy(status=s);load()}
 fun create(){if(_state.value.saving)return;_state.value=_state.value.copy(detail=null,editing=buildJsonObject{put("requestKey",java.util.UUID.randomUUID().toString())},error=null)}
 fun edit(){if(!_state.value.saving)_state.value=_state.value.copy(editing=_state.value.detail?.get("asset")?.jsonObject,error=null)}
 fun close(){if(!_state.value.saving){detailJob?.cancel();_state.value=_state.value.copy(detail=null,editing=null)}}
 fun open(id:String){detailJob?.cancel();detailJob=viewModelScope.launch{try{val detail=api.asset(id);currentCoroutineContext().ensureActive();_state.value=_state.value.copy(detail=detail)}catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}}}
 fun save(p:JsonObject,saveNew:Boolean=false)=viewModelScope.launch{
  if(_state.value.saving)return@launch
  _state.value=_state.value.copy(saving=true,error=null)
  try{
   val id=_state.value.editing?.get("id")?.jsonPrimitive?.contentOrNull
   val payload=if(id==null)JsonObject(p+mapOf("requestKey" to (_state.value.editing?.get("requestKey")?:JsonPrimitive(java.util.UUID.randomUUID().toString()))))else p
   val row=api.saveAsset(id,payload)
   _state.value=_state.value.copy(saving=false,editing=null,detail=null,message="Asset saved.")
   if(saveNew&&id==null)create() else open(row.str("id"))
   load()
  }catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}
 }
 fun action(id:String,p:JsonObject)=viewModelScope.launch{
  if(_state.value.saving)return@launch
  _state.value=_state.value.copy(saving=true,error=null)
  try{api.assetAction(id,p);_state.value=_state.value.copy(saving=false,message="Asset action confirmed.");open(id);load()}catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}
 }
 private fun fail(e:Exception){_state.value=_state.value.copy(loading=false,saving=false,error=when{e is IOException->"Offline. Your inputs were kept. Reconnect and retry.";e is ApiException&&e.status==403->"Permission or module settings do not allow this action.";e is ApiException&&e.serverMessage!=null->e.serverMessage;else->"The server rejected the request. Check the asset status and entered details, then retry."})}
}
