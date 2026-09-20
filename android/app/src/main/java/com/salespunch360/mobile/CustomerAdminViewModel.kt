package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class CustomerAdminState(val loading:Boolean=true,val saving:Boolean=false,val context:CustomerAdminContext?=null,val message:String?=null)
class CustomerAdminViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(CustomerAdminState());val state:StateFlow<CustomerAdminState> = _state
 init{load()}
 fun load()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);_state.value=try{CustomerAdminState(loading=false,context=api.customerAdmin())}catch(e:Exception){_state.value.copy(loading=false,message=message(e))}}
 fun create(request:CreateCustomerRequest,done:()->Unit)=save("Customer created.",done){api.createCustomer(request)}
 fun assign(customerId:String,userId:String,done:()->Unit={})=save("Customer assigned and Lead created.",done){api.assignCustomer(AssignCustomerRequest(customerId=customerId,assignedUserId=userId))}
 private fun save(notice:String,done:()->Unit,block:suspend()->Any)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,message=null);try{block();_state.value=CustomerAdminState(loading=false,context=api.customerAdmin(),message=notice);done()}catch(e:Exception){_state.value=_state.value.copy(saving=false,message=message(e))}}
 private fun message(e:Exception)=when((e as? ApiException)?.code){"INVALID_ASSIGNMENT"->"Choose an eligible Sales employee or Field Manager.";"CUSTOMER_NOT_FOUND"->"This customer is no longer available for assignment.";"BRANCH_FORBIDDEN"->"The selected user does not have access to this branch.";else->if(e is IOException)"You're offline." else "Customer change could not be completed."}
}
