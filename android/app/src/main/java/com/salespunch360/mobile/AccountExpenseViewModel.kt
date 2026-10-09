package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import java.io.IOException
import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
data class ExpenseState(val loading:Boolean=false,val saving:Boolean=false,val query:String="",val status:String?=null,val rows:List<JsonObject> = emptyList(),val options:JsonObject=buildJsonObject{},val detail:JsonObject?=null,val editing:JsonObject?=null,val requestKey:String=UUID.randomUUID().toString(),val error:String?=null,val message:String?=null,val newCategoryId:String?=null,val categoryOpen:Boolean=false,val downloaded:Pair<String,ByteArray>?=null)
class AccountExpenseViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ExpenseState());val state:StateFlow<ExpenseState> = _state
 private var loadJob:Job?=null;private var detailJob:Job?=null
 init{refresh()}
 fun refresh(){load(false)}
 private fun load(debounce:Boolean){loadJob?.cancel();val q=_state.value.query;val status=_state.value.status;loadJob=viewModelScope.launch{if(debounce)delay(250);_state.value=_state.value.copy(loading=true);try{val o=api.expenseOptions();val rows=api.expenses(q,status).map{it.jsonObject};_state.value=_state.value.copy(loading=false,options=o,rows=rows)}catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}}}
 fun search(v:String){_state.value=_state.value.copy(query=v);load(true)}
 fun filter(v:String?){_state.value=_state.value.copy(status=v);load(false)}
 fun create(){if(_state.value.saving)return;_state.value=_state.value.copy(editing=buildJsonObject{},detail=null,requestKey=UUID.randomUUID().toString(),error=null,newCategoryId=null)}
 fun edit(x:JsonObject){if(_state.value.saving)return;_state.value=_state.value.copy(editing=x,detail=null,error=null,newCategoryId=null)}
 fun dismiss(){if(_state.value.saving)return;detailJob?.cancel();_state.value=_state.value.copy(editing=null,detail=null,error=null)}
 fun open(id:String){detailJob?.cancel();detailJob=viewModelScope.launch{try{_state.value=_state.value.copy(detail=api.expense(id))}catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}}}
 fun save(payload:JsonObject,saveNew:Boolean=false)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{val id=_state.value.editing?.get("id")?.jsonPrimitive?.contentOrNull;val p=JsonObject(payload.toMutableMap().apply{if(id==null)put("requestKey",JsonPrimitive(_state.value.requestKey))});val x=api.saveExpense(id,p);_state.value=_state.value.copy(saving=false,editing=if(saveNew)buildJsonObject{}else null,requestKey=UUID.randomUUID().toString(),newCategoryId=null,message="${x.str("transactionNumber")} saved by the server.");if(!saveNew)open(x.str("id"));refresh()}catch(e:Exception){fail(e)}}
 fun action(id:String,action:String,status:String?=null,reason:String?=null,date:String?=null)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{api.expenseAction(id,buildJsonObject{put("action",action);status?.let{put("status",it)};reason?.let{put("reason",it)};date?.let{put("entryDate",it)}});_state.value=_state.value.copy(saving=false,message="Expense action confirmed by server.");open(id);refresh()}catch(e:Exception){fail(e)}}
 fun showCategory(v:Boolean){if(!_state.value.saving)_state.value=_state.value.copy(categoryOpen=v,error=null)}
 fun saveCategory(payload:JsonObject)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{val row=api.saveExpenseCategory(null,payload);val options=JsonObject(_state.value.options.toMutableMap().apply{put("categories",JsonArray(_state.value.options.array("categories").filter{it.str("id")!=row.str("id")}+row))});_state.value=_state.value.copy(saving=false,options=options,newCategoryId=row.str("id"),categoryOpen=false,message="Category saved. Entry values retained.")}catch(e:Exception){fail(e)}}
 // Scheduling is an explicit separate action after a saved expense, never launched alongside saving.
 fun recurring(payload:JsonObject)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{api.saveRecurringExpense(payload);_state.value=_state.value.copy(saving=false,detail=null,message="Separate future expense schedule saved by server.")}catch(e:Exception){fail(e)}}
 fun download(id:String,name:String)=viewModelScope.launch{try{_state.value=_state.value.copy(downloaded=name to api.expenseAttachment(id))}catch(e:Exception){fail(e)}}
 fun consumedDownload(){_state.value=_state.value.copy(downloaded=null)}
 fun attach(id:String,name:String,mime:String,bytes:ByteArray)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{api.uploadExpenseAttachment(id,name,mime,bytes);_state.value=_state.value.copy(saving=false,message="Attachment uploaded.");open(id)}catch(e:Exception){fail(e)}}
 private fun fail(e:Exception){_state.value=_state.value.copy(loading=false,saving=false,error=when{e is IOException->"You're offline. No expense change was confirmed; your inputs were kept.";e is ApiException&&e.serverMessage!=null->e.serverMessage;e is ApiException&&e.status==403->"Permission or module settings do not allow this action.";else->"The server rejected the expense action. Check the fields and try again."})}
}
