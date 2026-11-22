package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job

data class CustomerAdminState(val loading:Boolean=true,val saving:Boolean=false,val context:CustomerAdminContext?=null,val message:String?=null,val query:String="",val loadingMore:Boolean=false)
class CustomerAdminViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(CustomerAdminState());val state:StateFlow<CustomerAdminState> = _state
 private var loadJob:Job?=null;private var moreJob:Job?=null
 init{load()}
 fun setQuery(value:String){_state.value=_state.value.copy(query=value)}
 fun clearMessage(){_state.value=_state.value.copy(message=null)}
 fun load(){if(_state.value.saving)return;loadJob?.cancel();moreJob?.cancel();val query=_state.value.query;loadJob=viewModelScope.launch{_state.value=_state.value.copy(loading=true,loadingMore=false,message=null);try{val context=api.customerAdmin(query);_state.value=_state.value.copy(loading=false,context=context)}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(loading=false,message=message(e))}}}
 fun loadMore(){val current=_state.value;val context=current.context?:return;if(current.loading||current.loadingMore||current.saving||!context.hasMore)return;_state.value=current.copy(loadingMore=true,message=null);moreJob=viewModelScope.launch{try{val next=api.customerAdmin(context.q,context.page+1);_state.value=_state.value.copy(loadingMore=false,context=next.copy(customers=(context.customers+next.customers).distinctBy{it.id}))}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(loadingMore=false,message=message(e))}}}
 fun create(request:CreateCustomerRequest,done:()->Unit)=save("Lead details saved.",done){api.createCustomer(request)}
 fun assign(customerId:String,userId:String,done:()->Unit={})=save("Customer assigned and Lead created.",done){api.assignCustomer(AssignCustomerRequest(customerId=customerId,assignedUserId=userId))}
 private fun save(notice:String,done:()->Unit,block:suspend()->Any)=viewModelScope.launch{if(_state.value.saving||_state.value.loadingMore||_state.value.loading)return@launch;_state.value=_state.value.copy(saving=true,message=null);try{block();_state.value=_state.value.copy(saving=false,message=notice);done();try{_state.value=_state.value.copy(context=api.customerAdmin(_state.value.context?.q?:""))}catch(e:CancellationException){throw e}catch(_:Exception){_state.value=_state.value.copy(message="$notice Refresh pending.")}}catch(e:CancellationException){throw e}catch(e:Exception){_state.value=_state.value.copy(saving=false,message=message(e))}}
 private fun message(e:Exception)=when((e as? ApiException)?.code){"CLIENT_UPGRADE_REQUIRED"->"Update or reopen the app before creating a new lead.";"CREATION_REQUEST_CONFLICT"->"These details differ from an earlier submission. Open a new lead form to create another lead.";"INVALID_INPUT"->"Use a lead name of 2–160 characters and a valid phone number (7–15 digits, optional + prefix). Review the branch and assignment as well.";"CUSTOMER_ALREADY_ASSIGNED"->"Another admin assigned this customer. Reload the queue before retrying.";"INVALID_ASSIGNMENT"->"Choose an eligible Sales employee or Field Manager.";"CUSTOMER_NOT_FOUND"->"This customer is no longer available for assignment.";"BRANCH_FORBIDDEN"->"The selected user does not have access to this branch.";else->if(e is IOException)"You're offline." else "Customer change could not be completed."}
}
