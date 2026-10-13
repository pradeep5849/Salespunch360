package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*

data class ItemManagementState(
    val loading:Boolean=false,
    val saving:Boolean=false,
    val units:List<AccountMasterRecord> = emptyList(),
    val unitConversions:List<JsonObject> = emptyList(),
    val unitMode:Boolean=false,
    val categories:List<AccountMasterRecord> = emptyList(),
    val items:List<AccountMasterRecord> = emptyList(),
    val services:List<AccountMasterRecord> = emptyList(),
    val stock:List<JsonObject> = emptyList(),
    val stockLoaded:Boolean=false,
    val catalogLoaded:Boolean=false,
    val error:String?=null
)

class ItemManagementViewModel(app:Application):AndroidViewModel(app){
    private val api=ApiClient(SecureSession(app))
    private val _state=MutableStateFlow(ItemManagementState())
    val state:StateFlow<ItemManagementState> = _state
    private var loadJob:Job?=null
    private var loadGeneration=0L
    init{refresh()}

    fun refresh(){
        loadJob?.cancel();val generation=++loadGeneration
        _state.value=_state.value.copy(loading=true,error=null,stockLoaded=false,catalogLoaded=false,unitMode=false)
        loadJob=viewModelScope.launch{try{
            val options=api.accountMasterOptions("items")
            val units=if(options.itemSettings["itemUnits"]?.jsonPrimitive?.booleanOrNull!=false)loadAll("units","true")else emptyList()
            val categories=loadAll("categories","true")
            val items=loadAll("items","all")
            val services=loadAll("services","all")
            if(generation!=loadGeneration)return@launch
            _state.value=_state.value.copy(units=units,categories=categories,items=items,services=services,catalogLoaded=true)
            val stock=api.inventoryStock().map{it.jsonObject}
            com.salespunch360.mobile.account.productStockTotals(stock)
            if(generation==loadGeneration)_state.value=_state.value.copy(loading=false,stock=stock,stockLoaded=true,error=null)
        }catch(e:CancellationException){throw e}catch(e:Exception){if(generation==loadGeneration)fail(e)}}
    }
    fun refreshUnits(){
        loadJob?.cancel();val generation=++loadGeneration
        _state.value=_state.value.copy(loading=true,error=null,unitMode=true)
        loadJob=viewModelScope.launch{try{
            val options=api.accountMasterOptions("units")
            val units=loadAll("units","true")
            if(generation==loadGeneration)_state.value=_state.value.copy(loading=false,units=units,unitConversions=options.unitConversions,error=null)
        }catch(e:CancellationException){throw e}catch(e:Exception){if(generation==loadGeneration)fail(e)}}
    }
    fun clearError(){_state.value=_state.value.copy(error=null)}

    private suspend fun loadAll(kind:String,active:String):List<AccountMasterRecord>{
        return com.salespunch360.mobile.account.loadMasterPages { offset->api.accountMasterList(kind,"",active,offset=offset) }.distinctBy{it.id}
    }

    fun saveUnit(id:String?,name:String,symbol:String,done:()->Unit)=viewModelScope.launch{
        if(_state.value.saving)return@launch
        if(name.trim().length !in 1..80||symbol.trim().length !in 1..20){_state.value=_state.value.copy(error="Enter a unit name from 1 to 80 characters and short name from 1 to 20 characters.");return@launch}
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster("units",id,buildJsonObject{put("name",name.trim());put("symbol",symbol.trim())})
        }.onSuccess{_state.value=_state.value.copy(saving=false);refreshUnits();done()}.onFailure{fail(it as Exception)}
    }

    fun saveCategory(name:String,done:()->Unit)=viewModelScope.launch{
        if(_state.value.saving)return@launch
        if(name.trim().isEmpty()||name.trim().length>100){
            _state.value=_state.value.copy(error="Enter a category name from 1 to 100 characters.")
            return@launch
        }
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster("categories",null,buildJsonObject{put("name",name.trim());put("scope","BOTH")})
        }.onSuccess{_state.value=_state.value.copy(saving=false);refresh();done()}.onFailure{fail(it as Exception)}
    }

    fun setActive(kind:String,ids:List<String>,active:Boolean,done:()->Unit)=viewModelScope.launch{
        if(_state.value.saving)return@launch
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{api.setAccountItemsActive(kind,ids,active).also{require(it["count"]?.jsonPrimitive?.intOrNull==ids.distinct().size){"Incomplete item update"}}}
            .onSuccess{_state.value=_state.value.copy(saving=false);refresh();done()}
            .onFailure{fail(it as Exception)}
    }

    fun saveConversion(base:String,secondary:String,rate:String,done:()->Unit)=viewModelScope.launch{
        if(_state.value.saving)return@launch
        if(base.isBlank()||secondary.isBlank()||base==secondary||!Regex("[0-9]{1,14}(\\.[0-9]{1,4})?").matches(rate)||(rate.toBigDecimalOrNull()?.signum()?:0)<=0){_state.value=_state.value.copy(error="Choose different units and a positive rate with at most four decimal places.");return@launch}
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{api.saveUnitConversion(base,secondary,rate)}
            .onSuccess{_state.value=_state.value.copy(saving=false);refreshUnits();done()}
            .onFailure{fail(it as Exception)}
    }

    private fun fail(e:Exception){
        _state.value=_state.value.copy(loading=false,saving=false,error=when{
            e is IOException->"You're offline. Reconnect and try again."
            e is ApiException&&e.serverMessage!=null->e.serverMessage
            e is ApiException&&e.status==403->"You don't have permission for this item action."
            else->"Unable to complete the item action."
        })
    }
}
