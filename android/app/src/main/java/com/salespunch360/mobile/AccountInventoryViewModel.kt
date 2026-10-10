package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*

data class InventoryState(
 val loading:Boolean=false,
 val saving:Boolean=false,
 val mode:String="stock",
 val query:String="",
 val rows:List<JsonObject> = emptyList(),
 val options:JsonObject=buildJsonObject{},
 val itemRecords:List<AccountMasterRecord> = emptyList(),
 val serviceRecords:List<AccountMasterRecord> = emptyList(),
 val categories:List<AccountOption> = emptyList(),
 val editing:String?=null,
 val error:String?=null,
 val message:String?=null
)

class AccountInventoryViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app))
 private val _state=MutableStateFlow(InventoryState())
 val state:StateFlow<InventoryState> = _state
 private var loadJob:Job?=null
 private var generation=0L
 init{load()}
 private var contextQuery:String=""
 fun context(query:String){contextQuery=query}
 fun show(mode:String){_state.value=_state.value.copy(mode=mode,editing=null);load()}
 fun search(q:String){_state.value=_state.value.copy(query=q)}
 fun create(kind:String){_state.value=_state.value.copy(editing=kind)}
 fun dismiss(){_state.value=_state.value.copy(editing=null)}
 fun load(){
 loadJob?.cancel();val request=++generation;val mode=_state.value.mode;val query=contextQuery
 loadJob=viewModelScope.launch{
  _state.value=_state.value.copy(loading=true,error=null)
  try{
   val o=api.inventoryOptions()
   val r=when(mode){
    "stock"->api.inventoryStock(contextQuery=query)
    "low-stock"->api.inventoryStock(true,query)
    "batches","serials","prices"->api.inventoryCatalog(mode)
    else->api.inventoryHistory(mode)
   }.map{it.jsonObject}
   val items=runCatching{api.accountMasterList("items","", "true")}.getOrDefault(emptyList())
   val services=runCatching{api.accountMasterList("services","", "true")}.getOrDefault(emptyList())
   val masterOptions=runCatching{api.accountMasterOptions()}.getOrDefault(AccountMasterOptions())
   if(request==generation)_state.value=_state.value.copy(loading=false,options=o,rows=r,itemRecords=items,serviceRecords=services,categories=masterOptions.categories)
  }catch(e:CancellationException){throw e}catch(e:Exception){if(request==generation)fail(e)}
 }}
 fun save(kind:String,payload:JsonObject)=viewModelScope.launch{
  _state.value=_state.value.copy(saving=true,error=null)
  try{
   api.inventoryMutation(kind,payload)
   _state.value=_state.value.copy(saving=false,editing=null,message="Inventory movement confirmed by the server.")
   show(kind)
  }catch(e:Exception){fail(e)}
 }
 private fun fail(e:Exception){
  _state.value=_state.value.copy(loading=false,saving=false,error=when{
   e is IOException->"You're offline. No inventory change was confirmed."
   e is ApiException&&e.status==403->"Permission or subscription entitlement does not allow this action."
   else->"The server rejected the inventory action."
  })
 }
}
