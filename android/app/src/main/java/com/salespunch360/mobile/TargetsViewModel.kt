package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class TargetsState(val loading:Boolean=true,val saving:Boolean=false,val context:TargetsContext?=null,val message:String?=null)
class TargetsViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(TargetsState());val state:StateFlow<TargetsState> = _state
 init{load()};fun load()=viewModelScope.launch{_state.value=TargetsState();_state.value=try{TargetsState(false,context=api.targets())}catch(e:Exception){TargetsState(false,message=error(e))}}
 fun create(data:TargetRequest)=save{api.createTarget(data)}
 fun edit(target:SalesTarget,targetValue:String)=save{api.editTarget(EditTargetRequest(target.id,target.version,target.assignedUserId,target.metric,target.periodType,target.startDate.take(10),target.endDate.take(10),targetValue,target.currencyCode))}
 private fun save(block:suspend()->TargetsContext)=viewModelScope.launch{_state.value=_state.value.copy(saving=true,message=null);_state.value=try{TargetsState(false,context=block(),message="Target saved.")}catch(e:Exception){_state.value.copy(saving=false,message=error(e))}}
 private fun error(e:Exception)=if(e is ApiException&&e.code!=null)e.code.replace('_',' ').lowercase().replaceFirstChar{it.uppercase()} else "Targets couldn't be loaded."
}
