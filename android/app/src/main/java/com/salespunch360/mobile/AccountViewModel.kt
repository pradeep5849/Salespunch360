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

data class AccountUiState(val loading:Boolean=true,val refreshing:Boolean=false,val bootstrap:AccountBootstrap?=null,val dashboard:AccountDashboard?=null,val selectedPath:String="/workspace/account/dashboard",val error:String?=null)

class AccountViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(AccountUiState());val state:StateFlow<AccountUiState> = _state
 init{load()}
 fun load(refresh:Boolean=false)=viewModelScope.launch{_state.value=_state.value.copy(loading=!refresh,refreshing=refresh,error=null);try{val bootstrap=api.accountBootstrap();val dashboard=api.accountDashboard(bootstrap.branch.branchId,bootstrap.branch.mode=="COMPANY");_state.value=_state.value.copy(loading=false,refreshing=false,bootstrap=bootstrap,dashboard=dashboard)}catch(error:Exception){_state.value=_state.value.copy(loading=false,refreshing=false,error=message(error))}}
 fun select(path:String){_state.value=_state.value.copy(selectedPath=path)}
 fun selectBranch(branchId:String?,companyWide:Boolean)=viewModelScope.launch{_state.value=_state.value.copy(refreshing=true,error=null);try{val bootstrap=api.accountBootstrap(branchId,companyWide);val dashboard=api.accountDashboard(branchId,companyWide);_state.value=_state.value.copy(refreshing=false,bootstrap=bootstrap,dashboard=dashboard,selectedPath="/workspace/account/dashboard")}catch(error:Exception){_state.value=_state.value.copy(refreshing=false,error=message(error))}}
 private fun message(error:Exception)=when{error is IOException->"You're offline. Reconnect and try again.";error is ApiException&&error.status==403->"Your Account access has changed.";else->"Account data could not be loaded. Please try again."}
}
