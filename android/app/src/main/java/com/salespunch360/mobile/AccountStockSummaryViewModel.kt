package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.SecureSession
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class StockSummaryState(
 val loading:Boolean=false,val exporting:Boolean=false,
 val filters:Map<String,String> = emptyMap(),val appliedFilters:Map<String,String>?=null,
 val data:JsonObject?=null,val error:String?=null,val export:Pair<String,ByteArray>?=null
)
class AccountStockSummaryViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app))
 private val _state=MutableStateFlow(StockSummaryState())
 val state:StateFlow<StockSummaryState> = _state
 private var request:Job?=null;private var exportRequest:Job?=null;private var generation=0L
 fun context(query:String){
  val uri=android.net.Uri.parse("https://internal.invalid/?$query")
  _state.value=StockSummaryState(filters=listOf("branchId","scope","asOf").mapNotNull{key->uri.getQueryParameter(key)?.takeIf{it.isNotBlank()}?.let{key to it}}.toMap())
  run()
 }
 fun filter(key:String,value:String){_state.value=_state.value.copy(filters=_state.value.filters.toMutableMap().apply{if(value.isBlank())remove(key) else put(key,value)},error=null)}
 fun reset(){_state.value=_state.value.copy(filters=_state.value.filters.filterKeys{it=="branchId"||it=="scope"||it=="asOf"});run()}
 fun run(){
  request?.cancel();exportRequest?.cancel();val version=++generation;val filters=_state.value.filters.toMap()
  _state.value=_state.value.copy(loading=true,exporting=false,error=null,export=null)
  request=viewModelScope.launch{try{
   val data=api.inventorySummary(filters)
   com.salespunch360.mobile.account.stockSummaryMetrics((data["filtered"] as? JsonArray)?.map{it.jsonObject}.orEmpty())
   val context=data["context"] as? JsonObject
   val effective=filters.toMutableMap().apply{
    remove("branchId");remove("scope")
    if(context?.get("mode")?.jsonPrimitive?.content=="BRANCH")put("branchId",context["branchId"]!!.jsonPrimitive.content) else put("scope","all")
   }
   if(version==generation)_state.value=_state.value.copy(loading=false,data=data,appliedFilters=effective)
  }catch(e:CancellationException){throw e}catch(e:Exception){if(version==generation)_state.value=_state.value.copy(loading=false,data=null,appliedFilters=null,error=message(e))}}
 }
 fun export(format:String){
  if(_state.value.loading||_state.value.exporting)return
  val filters=_state.value.appliedFilters?.toMap()?:return;val version=generation
  _state.value=_state.value.copy(exporting=true,error=null)
  exportRequest=viewModelScope.launch{try{
   val bytes=api.inventorySummaryExport(format,filters)
   if(version==generation)_state.value=_state.value.copy(exporting=false,export="stock-summary-${java.util.UUID.randomUUID()}.$format" to bytes)
  }catch(e:CancellationException){throw e}catch(e:Exception){if(version==generation)_state.value=_state.value.copy(exporting=false,error=message(e))}}
 }
 fun consumed(){_state.value=_state.value.copy(export=null)}
 fun shareFailed(){_state.value=_state.value.copy(export=null,error="The report could not be shared. Try again.")}
 private fun message(error:Exception)=when{
  error is IOException->"You're offline. Reconnect and retry the report."
  error is ApiException&&error.status==403->"Your permissions, branch access or Items settings do not allow this report."
  else->"Check the report date and filters, then try again."
 }
}
