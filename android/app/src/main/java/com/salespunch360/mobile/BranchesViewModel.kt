package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class BranchesState(val loading:Boolean=true,val saving:Boolean=false,val branches:List<BranchDetails> = emptyList(),val message:String?=null)
class BranchesViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(BranchesState());val state:StateFlow<BranchesState> = _state
 init{load()}
 fun load()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);_state.value=try{BranchesState(loading=false,branches=api.branches())}catch(e:Exception){_state.value.copy(loading=false,message=message(e))}}
 fun create(name:String,code:String,address:String?,city:String?,state:String?,postal:String?,country:String?,phone:String?,email:String?,done:()->Unit)=save(done){api.createBranch(name,code,address,city,state,postal,country,phone,email)}
 fun edit(branch:BranchDetails,done:()->Unit)=save(done){api.editBranch(branch)}
 fun setActive(branch:BranchDetails,done:()->Unit={})=save(done){api.setBranchActive(branch.id,!branch.isActive)}
 private fun save(done:()->Unit,block:suspend()->Any)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,message=null);try{block();_state.value=BranchesState(loading=false,branches=api.branches(),message="Branch saved.");done()}catch(e:Exception){_state.value=_state.value.copy(saving=false,message=message(e))}}
 private fun message(e:Exception)=when((e as? ApiException)?.code){"DUPLICATE_BRANCH_CODE"->"Branch code is already in use.";"PRIMARY_BRANCH_PROTECTED"->"The Primary Head Office cannot be deactivated.";"BRANCH_IN_USE"->"This branch has active access or operational records and cannot be deactivated.";"FORBIDDEN"->"Only the Primary Admin can manage branches.";else->if(e is IOException)"You're offline." else "Branch change could not be completed."}
}
