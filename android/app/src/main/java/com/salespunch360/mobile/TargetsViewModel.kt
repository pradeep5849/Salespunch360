package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class TargetsState(val loading:Boolean=true,val saving:Boolean=false,val context:TargetsContext?=null,val monthly:MonthlyTargetsContext?=null,val message:String?=null)
class TargetsViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(TargetsState());val state:StateFlow<TargetsState> = _state
 init{load()};fun load()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);_state.value=try{_state.value.copy(loading=false,context=api.targets())}catch(e:Exception){_state.value.copy(loading=false,message=error(e))}}
 fun loadMonthly()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,message=null);_state.value=try{_state.value.copy(loading=false,monthly=api.monthlyTargets())}catch(e:Exception){_state.value.copy(loading=false,message=error(e))}}
 fun create(data:TargetRequest)=save{api.createTarget(data)}
 fun edit(data:EditTargetRequest)=save{api.editTarget(data)}
 private fun save(block:suspend()->TargetsContext)=viewModelScope.launch{_state.value=_state.value.copy(saving=true,message=null);_state.value=try{_state.value.copy(loading=false,saving=false,context=block(),message="Target saved.")}catch(e:Exception){_state.value.copy(saving=false,message=error(e))}}
 private fun error(e:Exception)=apiMessage(e,"Targets couldn't be loaded.")
}
