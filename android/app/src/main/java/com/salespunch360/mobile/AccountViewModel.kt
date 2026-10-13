package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.AccountBootstrap
import com.salespunch360.mobile.data.AccountDashboard
import com.salespunch360.mobile.data.AccountHome
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.SecureSession
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val ACCOUNT_ROOT = "/workspace/account"

data class AccountUiState(
    val loading:Boolean=true,
    val refreshing:Boolean=false,
    val bootstrap:AccountBootstrap?=null,
    val dashboard:AccountDashboard?=null,
    val home:AccountHome?=null,
    val homePartyMode:Boolean=false,
    val homeQuery:String="",
    val homeTypes:Set<String> = emptySet(),
    val selectedPath:String=ACCOUNT_ROOT,
    val error:String?=null
)

class AccountViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app))
 private val _state=MutableStateFlow(AccountUiState())
 val state:StateFlow<AccountUiState> = _state
 private val history=mutableListOf<String>()
 private var failedBranchSelection:Pair<String?,Boolean>?=null

 init{load()}

 fun load(refresh:Boolean=false)=viewModelScope.launch{
  if(_state.value.refreshing)return@launch
  _state.value=_state.value.copy(loading=!refresh,refreshing=refresh,error=null)
  try{
   val selectedBranch=_state.value.bootstrap?.branch
   val bootstrap=api.accountBootstrap(selectedBranch?.branchId,selectedBranch?.mode=="COMPANY")
   val dashboard=api.accountDashboard(bootstrap.branch.branchId,bootstrap.branch.mode=="COMPANY")
   val home=api.accountHome(branchId=bootstrap.branch.branchId,companyWide=bootstrap.branch.mode=="COMPANY")
   _state.value=_state.value.copy(loading=false,refreshing=false,bootstrap=bootstrap,dashboard=dashboard,home=home)
  }catch(error:Exception){
   _state.value=_state.value.copy(loading=false,refreshing=false,error=message(error))
  }
 }

 fun select(path:String){
  val current=_state.value.selectedPath
  if(path==current)return
  if(current in listOf("/workspace/account/settings/general","/workspace/account/settings/multi-currency","/workspace/account/settings/modules","/workspace/branches","/workspace/account/settings/multi-branch"))refreshDisplayPreferences()
  history+=current
  if(history.size>60)history.removeAt(0)
  _state.value=_state.value.copy(selectedPath=path)
 }

 fun back():Boolean{
  val current=_state.value.selectedPath
  if(current in listOf("/workspace/account/settings/general","/workspace/account/settings/multi-currency","/workspace/account/settings/modules","/workspace/branches","/workspace/account/settings/multi-branch"))refreshDisplayPreferences()
  val previous=if(history.isNotEmpty())history.removeAt(history.lastIndex) else null
  return when{
   previous!=null->{_state.value=_state.value.copy(selectedPath=previous);true}
   current!=ACCOUNT_ROOT->{_state.value=_state.value.copy(selectedPath=ACCOUNT_ROOT);true}
   else->false
  }
 }

 private fun refreshDisplayPreferences()=viewModelScope.launch{
  try{val branch=_state.value.bootstrap?.branch;val bootstrap=api.accountBootstrap(branch?.branchId,branch?.mode=="COMPANY");_state.value=_state.value.copy(bootstrap=bootstrap)}catch(_:Exception){_state.value=_state.value.copy(error="Display settings could not be refreshed. Retry to load saved preferences.")}
 }

 fun resetNavigation(){history.clear();_state.value=_state.value.copy(selectedPath=ACCOUNT_ROOT)}

 fun setHomePartyMode(party:Boolean){_state.value=_state.value.copy(homePartyMode=party)}
 fun searchHome(query:String=_state.value.homeQuery,types:Set<String> = _state.value.homeTypes)=viewModelScope.launch{
  _state.value=_state.value.copy(homeQuery=query,homeTypes=types,refreshing=true,error=null)
  try{val branch=_state.value.bootstrap?.branch;val home=api.accountHome(query,types,branch?.branchId,branch?.mode=="COMPANY");_state.value=_state.value.copy(home=home,refreshing=false)}catch(error:Exception){_state.value=_state.value.copy(refreshing=false,error=message(error))}
 }

 fun downloadDocumentPdf(type:String,id:String,onReady:(ByteArray)->Unit)=viewModelScope.launch{try{onReady(api.accountDocumentPdf(type,id))}catch(error:Exception){_state.value=_state.value.copy(error=message(error))}}

 fun retry(){val failed=failedBranchSelection;if(failed!=null)selectBranch(failed.first,failed.second)else load(true)}
 fun selectBranch(branchId:String?,companyWide:Boolean)=viewModelScope.launch{
  if(_state.value.refreshing||_state.value.loading)return@launch
  val available=_state.value.bootstrap?:return@launch
  if(!com.salespunch360.mobile.account.isSelectableAccountBranch(available.availableBranches.map{it.id}.toSet(),available.canConsolidate,branchId,companyWide)){_state.value=_state.value.copy(error="That branch or company scope is not available to your account.");return@launch}
  failedBranchSelection=branchId to companyWide
  _state.value=_state.value.copy(refreshing=true,error=null)
  try{
   val bootstrap=api.accountBootstrap(branchId,companyWide)
   val dashboard=api.accountDashboard(branchId,companyWide)
   val home=api.accountHome(_state.value.homeQuery,_state.value.homeTypes,branchId,companyWide)
   history.clear()
   failedBranchSelection=null
   _state.value=_state.value.copy(refreshing=false,bootstrap=bootstrap,dashboard=dashboard,home=home,selectedPath=ACCOUNT_ROOT)
  }catch(error:Exception){
   _state.value=_state.value.copy(refreshing=false,error=message(error))
  }
 }

 private fun message(error:Exception)=when{
  error is IOException->"You're offline. Reconnect and try again."
  error is ApiException&&error.status==403->"Your Account access has changed."
  else->"Account data could not be loaded. Please try again."
 }
}
