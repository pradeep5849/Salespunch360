package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
data class AddItemState(val loading:Boolean=true,val saving:Boolean=false,val units:List<AccountOption> = emptyList(),val itemSettings:JsonObject=JsonObject(emptyMap()),val error:String?=null)
class AccountAddItemViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(AddItemState());val state=_state.asStateFlow();init{load()} fun load()=viewModelScope.launch{runCatching{api.accountMasterOptions()}.onSuccess{_state.value=_state.value.copy(loading=false,units=it.units)}.onFailure{_state.value=_state.value.copy(loading=false,error="Unable to load item options.")}} fun save(service:Boolean,name:String,unitId:String?,done:()->Unit)=viewModelScope.launch{_state.value=_state.value.copy(saving=true,error=null);runCatching{api.saveAccountMaster(if(service)"services" else "items",null,buildJsonObject{put("name",name.trim());put("code","");unitId?.let{put("unitId",it)};put("sellingRate","0");put("cost","0");put("taxRate","0");put("hsnSacCode","");if(!service){put("trackInventory",false);put("trackingMode","NONE");put("lowStockThreshold",0)}})}.onSuccess{_state.value=_state.value.copy(saving=false);done()}.onFailure{_state.value=_state.value.copy(saving=false,error="Item could not be saved.")}}}
