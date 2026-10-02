package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class ItemManagementState(
    val loading:Boolean=false,
    val saving:Boolean=false,
    val units:List<AccountMasterRecord> = emptyList(),
    val categories:List<AccountMasterRecord> = emptyList(),
    val items:List<AccountMasterRecord> = emptyList(),
    val services:List<AccountMasterRecord> = emptyList(),
    val error:String?=null
)

class ItemManagementViewModel(app:Application):AndroidViewModel(app){
    private val api=ApiClient(SecureSession(app))
    private val _state=MutableStateFlow(ItemManagementState())
    val state:StateFlow<ItemManagementState> = _state
    init{refresh()}

    fun refresh()=viewModelScope.launch{
        _state.value=_state.value.copy(loading=true,error=null)
        try{
            val units=api.accountMasterList("units","", "true")
            val categories=api.accountMasterList("categories","", "true")
            val items=api.accountMasterList("items","", "all")
            val services=api.accountMasterList("services","", "all")
            _state.value=_state.value.copy(loading=false,units=units,categories=categories,items=items,services=services)
        }catch(e:Exception){fail(e)}
    }

    fun saveUnit(id:String?,name:String,symbol:String,done:()->Unit)=viewModelScope.launch{
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster("units",id,buildJsonObject{put("name",name.trim());put("symbol",symbol.trim())})
        }.onSuccess{_state.value=_state.value.copy(saving=false);refresh();done()}.onFailure{fail(it as Exception)}
    }

    fun saveCategory(name:String,done:()->Unit)=viewModelScope.launch{
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster("categories",null,buildJsonObject{put("name",name.trim());put("scope","BOTH")})
        }.onSuccess{_state.value=_state.value.copy(saving=false);refresh();done()}.onFailure{fail(it as Exception)}
    }

    fun setActive(kind:String,ids:List<String>,active:Boolean,done:()->Unit)=viewModelScope.launch{
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{api.setAccountItemsActive(kind,ids,active)}
            .onSuccess{_state.value=_state.value.copy(saving=false);refresh();done()}
            .onFailure{fail(it as Exception)}
    }

    fun saveConversion(base:String,secondary:String,rate:String,done:()->Unit)=viewModelScope.launch{
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{api.saveUnitConversion(base,secondary,rate)}
            .onSuccess{_state.value=_state.value.copy(saving=false);done()}
            .onFailure{fail(it as Exception)}
    }

    private fun fail(e:Exception){
        _state.value=_state.value.copy(loading=false,saving=false,error=when{
            e is IOException->"You're offline. Reconnect and try again."
            e is ApiException&&e.status==403->"You don't have permission for this item action."
            else->"Unable to complete the item action."
        })
    }
}
