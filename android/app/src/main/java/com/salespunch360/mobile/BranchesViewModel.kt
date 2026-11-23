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
 fun clearMessage(){_state.value=_state.value.copy(message=null)}
 fun load()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);_state.value=try{BranchesState(loading=false,branches=api.branches())}catch(e:Exception){_state.value.copy(loading=false,message=message(e))}}
 fun create(name:String,code:String,address:String?,city:String?,state:String?,postal:String?,country:String?,phone:String?,email:String?,firstBranchAction:String?=null,done:()->Unit)=save(done){api.createBranch(name,code,address,city,state,postal,country,phone,email,firstBranchAction)}
 fun edit(branch:BranchDetails,done:()->Unit)=save(done){api.editBranch(branch)}
 fun setActive(branch:BranchDetails,done:()->Unit={})=save(done){api.setBranchActive(branch.id,!branch.isActive)}
 private fun save(done:()->Unit,block:suspend()->Any)=viewModelScope.launch{if(_state.value.saving)return@launch;_state.value=_state.value.copy(saving=true,message=null);try{block();_state.value=BranchesState(loading=false,branches=api.branches(),message="Branch saved.");done()}catch(e:Exception){val refreshed=if((e as? ApiException)?.code in listOf("FIRST_BRANCH_SETUP_CHANGED","DUPLICATE_BRANCH_CODE"))runCatching{api.branches()}.getOrNull()else null;_state.value=_state.value.copy(saving=false,branches=refreshed?:_state.value.branches,message=if(e is IOException)"Save could not be confirmed. Close this form and Refresh before retrying." else message(e))}}
 private fun message(e:Exception)=when((e as? ApiException)?.code){"FIRST_BRANCH_CHOICE_REQUIRED"->"Choose where existing business should stay.";"FIRST_BRANCH_SETUP_CHANGED"->"Branch setup changed. Refresh and try again.";"BRANCH_SETUP_INVALID"->"Head Office setup needs review.";"DUPLICATE_BRANCH_CODE"->"Branch code is already in use.";"PRIMARY_BRANCH_PROTECTED"->"The Primary Head Office cannot be deactivated.";"BRANCH_IN_USE"->"This branch has active access or operational records and cannot be deactivated.";"FORBIDDEN"->"Only the Primary Admin can manage branches.";else->if(e is IOException)"You're offline." else "Branch change could not be completed."}
}
