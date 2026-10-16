package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class ExpenseCategoryState(val itemTab:Boolean=false,val expenseItems:List<JsonObject> = emptyList(),val itemTotal:Int=0,val itemNextOffset:Int?=null,val canCreateExpense:Boolean=false,val summary:JsonObject?=null,val scopeLabel:String="Selected scope",val canManage:Boolean=false,val message:String?=null,val loading:Boolean=false,val saving:Boolean=false,val query:String="",val categories:List<JsonObject> = emptyList(),val ledgers:List<JsonObject> = emptyList(),val editing:JsonObject?=null,val error:String?=null)
class ExpenseCategoryViewModel(app:Application):AndroidViewModel(app) {
    private val api=ApiClient(SecureSession(app))
    private val _state=MutableStateFlow(ExpenseCategoryState())
    val state:StateFlow<ExpenseCategoryState> = _state
    private var contextQuery:String?=null
    private var generation=0
    private var readJob:Job?=null
    fun context(query:String) {
        if(contextQuery==query)return
        contextQuery=query
        _state.value=ExpenseCategoryState()
        load()
    }
    fun showItems(value:Boolean){if(_state.value.itemTab==value||_state.value.saving)return;_state.value=_state.value.copy(itemTab=value,query="");load()}
    fun loadMoreItems(){if(_state.value.itemTab&&_state.value.itemNextOffset!=null&&!_state.value.loading)load(true)}
    fun load(append:Boolean=false) {
        if(_state.value.saving)return
        val snapshot=_state.value
        val request=++generation
        readJob?.cancel()
        _state.value=_state.value.copy(loading=true,error=null,summary=null,categories=emptyList(),ledgers=emptyList(),canManage=false,canCreateExpense=false,expenseItems=if(append)snapshot.expenseItems else emptyList())
        readJob=viewModelScope.launch {
            try {
                val x=api.expenseCategories(if(snapshot.itemTab)""else snapshot.query,contextQuery.orEmpty())
                val items=if(snapshot.itemTab)api.expenseItems(snapshot.query,if(append)snapshot.itemNextOffset?:0 else 0)else null
                if(request!=generation)return@launch
                val scope=x["branchContext"] as? JsonObject
                val label=if(scope?.get("mode")?.jsonPrimitive?.contentOrNull=="COMPANY")"Company consolidated" else scope?.get("branchName")?.jsonPrimitive?.contentOrNull?:"Selected branch"
                _state.value=_state.value.copy(loading=false,canCreateExpense=x["canCreateExpense"]?.jsonPrimitive?.booleanOrNull==true,expenseItems=(if(append)snapshot.expenseItems else emptyList())+(items?.get("rows") as? JsonArray)?.map{it.jsonObject}.orEmpty(),itemTotal=items?.get("total")?.jsonPrimitive?.intOrNull?:0,itemNextOffset=items?.get("nextOffset")?.jsonPrimitive?.intOrNull,scopeLabel=label,summary=x["summary"] as? JsonObject,canManage=x["canManage"]?.jsonPrimitive?.booleanOrNull==true,categories=x["categories"]?.jsonArray?.map{it.jsonObject}.orEmpty(),ledgers=x["ledgers"]?.jsonArray?.map{it.jsonObject}.orEmpty())
            } catch(e:CancellationException) { throw e } catch(e:Exception) { if(request==generation)fail(e) }
        }
    }
    fun search(q:String){if(_state.value.saving)return;_state.value=_state.value.copy(query=q);load()}
    fun edit(x:JsonObject=buildJsonObject{}){if(_state.value.canManage&&!_state.value.saving)_state.value=_state.value.copy(editing=x,error=null)}
    fun close(){if(!_state.value.saving)_state.value=_state.value.copy(editing=null)}
    fun save(p:JsonObject)=viewModelScope.launch {
        if(_state.value.saving||!_state.value.canManage)return@launch
        val request=generation
        _state.value=_state.value.copy(saving=true,error=null)
        try {
            api.saveExpenseCategory(_state.value.editing?.get("id")?.jsonPrimitive?.contentOrNull,p)
            if(request!=generation)return@launch
            _state.value=_state.value.copy(saving=false,message="Category saved.",editing=null)
            load()
        } catch(e:CancellationException){throw e} catch(e:Exception){if(request==generation)fail(e)}
    }
    fun disable(id:String)=viewModelScope.launch {
        if(_state.value.saving||!_state.value.canManage)return@launch
        val request=generation
        _state.value=_state.value.copy(saving=true,error=null)
        try {
            api.disableExpenseCategory(id)
            if(request!=generation)return@launch
            _state.value=_state.value.copy(saving=false,message="Category deactivated.")
            load()
        } catch(e:CancellationException){throw e} catch(e:Exception){if(request==generation)fail(e)}
    }
    private fun fail(e:Exception){_state.value=_state.value.copy(loading=false,saving=false,error=when {
        e is IOException->"Offline. No category change was confirmed; your fields were kept."
        e is ApiException&&e.serverMessage!=null->e.serverMessage
        e is ApiException&&e.status==403->"Your permission or module settings do not allow category changes."
        else->"Category action rejected by server. Check the fields and try again."
    })}
}
