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
data class ExpenseState(val recurringOpen:Boolean=false,val recurringRows:List<JsonObject> = emptyList(),val loading:Boolean=false,val saving:Boolean=false,val query:String="",val status:String?=null,val type:String?=null,val categoryId:String?=null,val summary:JsonObject?=null,val total:Int=0,val nextOffset:Int?=null,val rows:List<JsonObject> = emptyList(),val options:JsonObject=buildJsonObject{},val detail:JsonObject?=null,val editing:JsonObject?=null,val requestKey:String=UUID.randomUUID().toString(),val error:String?=null,val message:String?=null,val newCategoryId:String?=null,val categoryOpen:Boolean=false,val downloaded:Pair<String,ByteArray>?=null)
class AccountExpenseViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ExpenseState());val state:StateFlow<ExpenseState> = _state
 private var loadJob:Job?=null;private var detailJob:Job?=null
 init{refresh()}
 fun refresh(){load(false)}
 private var contextQuery=""
 fun context(query:String){contextQuery=query;load(false)}
 private fun load(debounce:Boolean,append:Boolean=false){
  if(append&&_state.value.loading)return
  loadJob?.cancel();val snapshot=_state.value;val offset=if(append)snapshot.nextOffset?:return else 0
  loadJob=viewModelScope.launch{
   if(debounce)delay(250)
   _state.value=_state.value.copy(loading=true,error=null,rows=if(append)snapshot.rows else emptyList(),total=if(append)snapshot.total else 0,nextOffset=if(append)snapshot.nextOffset else null)
   try{
    val o=api.expenseOptions()
    val result=api.expensePage(snapshot.query,snapshot.status,snapshot.type,snapshot.categoryId,offset,contextQuery)
    val rows=result["rows"]!!.jsonArray.map{it.jsonObject}
    _state.value=_state.value.copy(loading=false,options=o,rows=if(append)(snapshot.rows+rows).distinctBy{it.str("id")}else rows,summary=result["summary"] as? JsonObject,total=result["total"]!!.jsonPrimitive.int,nextOffset=result["nextOffset"]?.jsonPrimitive?.intOrNull,error=null)
   }catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}
  }
 }
 fun loadMore(){load(false,true)}
 fun type(v:String?){_state.value=_state.value.copy(type=v);load(false)}
 fun category(v:String?){_state.value=_state.value.copy(categoryId=v);load(false)}
 fun showRecurring(open:Boolean){if(_state.value.saving)return;_state.value=_state.value.copy(recurringOpen=open,error=null);if(open)loadRecurring()}
 private fun loadRecurring()=viewModelScope.launch{_state.value=_state.value.copy(loading=true);try{val rows=api.recurringExpenses().map{it.jsonObject};_state.value=_state.value.copy(loading=false,recurringRows=rows,error=null)}catch(e:Exception){fail(e)}}
 fun recurringAction(id:String,payload:JsonObject)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{val result=api.recurringExpenseAction(id,payload);_state.value=_state.value.copy(saving=false,message="Recurring action confirmed by server.");if(payload.str("action")=="GENERATE"){_state.value=_state.value.copy(recurringOpen=false);open(result.str("id"));refresh()}else loadRecurring()}catch(e:Exception){fail(e)}}
 fun search(v:String){_state.value=_state.value.copy(query=v);load(true)}
 fun filter(v:String?){_state.value=_state.value.copy(status=v);load(false)}
 fun create(){if(_state.value.saving||_state.value.loading)return;val selectedBranch=android.net.Uri.parse("https://local.invalid/?$contextQuery").getQueryParameter("branchId");_state.value=_state.value.copy(editing=buildJsonObject{selectedBranch?.let{put("branchId",it)}},detail=null,requestKey=UUID.randomUUID().toString(),error=null,newCategoryId=null)}
 fun edit(x:JsonObject){if(_state.value.saving)return;_state.value=_state.value.copy(editing=x,detail=null,error=null,newCategoryId=null)}
 fun dismiss(){if(_state.value.saving)return;detailJob?.cancel();_state.value=_state.value.copy(editing=null,detail=null,error=null)}
 fun open(id:String){detailJob?.cancel();detailJob=viewModelScope.launch{try{_state.value=_state.value.copy(detail=api.expense(id))}catch(e:CancellationException){throw e}catch(e:Exception){fail(e)}}}
 fun save(payload:JsonObject,saveNew:Boolean=false)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{val id=_state.value.editing?.get("id")?.jsonPrimitive?.contentOrNull;val p=JsonObject(payload.toMutableMap().apply{if(id==null)put("requestKey",JsonPrimitive(_state.value.requestKey))});val x=api.saveExpense(id,p);_state.value=_state.value.copy(saving=false,editing=if(saveNew)buildJsonObject{put("branchId",x.str("branchId"))}else null,requestKey=UUID.randomUUID().toString(),newCategoryId=null,message="${x.str("transactionNumber")} saved by the server.");if(!saveNew)open(x.str("id"));refresh()}catch(e:Exception){fail(e)}}
 fun action(id:String,action:String,status:String?=null,reason:String?=null,date:String?=null)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{api.expenseAction(id,buildJsonObject{put("action",action);status?.let{put("status",it)};reason?.let{put("reason",it)};date?.let{put("entryDate",it)}});_state.value=_state.value.copy(saving=false,message="Expense action confirmed by server.");open(id);refresh()}catch(e:Exception){fail(e)}}
 fun showCategory(v:Boolean){if(!_state.value.saving)_state.value=_state.value.copy(categoryOpen=v,error=null)}
 fun saveCategory(payload:JsonObject)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{val row=api.saveExpenseCategory(null,payload);val options=JsonObject(_state.value.options.toMutableMap().apply{put("categories",JsonArray(_state.value.options.array("categories").filter{it.str("id")!=row.str("id")}+row))});_state.value=_state.value.copy(saving=false,options=options,newCategoryId=row.str("id"),categoryOpen=false,message="Category saved. Entry values retained.")}catch(e:Exception){fail(e)}}
 // Scheduling is an explicit separate action after a saved expense, never launched alongside saving.
 fun recurring(payload:JsonObject)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{api.saveRecurringExpense(payload);_state.value=_state.value.copy(saving=false,detail=null,message="Separate future expense schedule saved by server.")}catch(e:Exception){fail(e)}}
 fun download(id:String,name:String)=viewModelScope.launch{try{_state.value=_state.value.copy(downloaded=name to api.expenseAttachment(id))}catch(e:Exception){fail(e)}}
 fun consumedDownload(){_state.value=_state.value.copy(downloaded=null)}
 fun attach(id:String,name:String,mime:String,bytes:ByteArray)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,error=null);try{api.uploadExpenseAttachment(id,name,mime,bytes);_state.value=_state.value.copy(saving=false,message="Attachment uploaded.");open(id)}catch(e:Exception){fail(e)}}
 private fun fail(e:Exception){val denied=e is ApiException&&e.status==403;_state.value=_state.value.copy(loading=false,saving=false,rows=if(denied)emptyList()else _state.value.rows,options=if(denied)buildJsonObject{}else _state.value.options,total=if(denied)0 else _state.value.total,nextOffset=if(denied)null else _state.value.nextOffset,error=when{e is IOException->"You're offline. No expense change was confirmed; your inputs were kept.";e is ApiException&&e.serverMessage!=null->e.serverMessage;e is ApiException&&e.status==403->"Permission or module settings do not allow this action.";else->"The server rejected the expense action. Check the fields and try again."})}
}
