package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.AccountBootstrap
import com.salespunch360.mobile.data.AccountDashboard
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
    val selectedPath:String=ACCOUNT_ROOT,
    val error:String?=null
)

class AccountViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app))
 private val _state=MutableStateFlow(AccountUiState())
 val state:StateFlow<AccountUiState> = _state
 private val history=mutableListOf<String>()

 init{load()}

 fun load(refresh:Boolean=false)=viewModelScope.launch{
  _state.value=_state.value.copy(loading=!refresh,refreshing=refresh,error=null)
  try{
   val bootstrap=api.accountBootstrap()
   val dashboard=api.accountDashboard(bootstrap.branch.branchId,bootstrap.branch.mode=="COMPANY")
   _state.value=_state.value.copy(loading=false,refreshing=false,bootstrap=bootstrap,dashboard=dashboard)
  }catch(error:Exception){
   _state.value=_state.value.copy(loading=false,refreshing=false,error=message(error))
  }
 }

 fun select(path:String){
  val current=_state.value.selectedPath
  if(path==current)return
  history+=current
  if(history.size>60)history.removeAt(0)
  _state.value=_state.value.copy(selectedPath=path)
 }

 fun back():Boolean{
  val current=_state.value.selectedPath
  val previous=if(history.isNotEmpty())history.removeAt(history.lastIndex) else null
  return when{
   previous!=null->{_state.value=_state.value.copy(selectedPath=previous);true}
   current!=ACCOUNT_ROOT->{_state.value=_state.value.copy(selectedPath=ACCOUNT_ROOT);true}
   else->false
  }
 }

 fun resetNavigation(){history.clear();_state.value=_state.value.copy(selectedPath=ACCOUNT_ROOT)}

 fun selectBranch(branchId:String?,companyWide:Boolean)=viewModelScope.launch{
  _state.value=_state.value.copy(refreshing=true,error=null)
  try{
   val bootstrap=api.accountBootstrap(branchId,companyWide)
   val dashboard=api.accountDashboard(branchId,companyWide)
   history.clear()
   _state.value=_state.value.copy(refreshing=false,bootstrap=bootstrap,dashboard=dashboard,selectedPath=ACCOUNT_ROOT)
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
