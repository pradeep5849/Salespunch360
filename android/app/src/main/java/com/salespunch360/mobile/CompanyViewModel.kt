package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class CompanyState(val loading:Boolean=true,val saving:Boolean=false,val context:CompanyContext?=null,val message:String?=null)
class CompanyViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(CompanyState());val state:StateFlow<CompanyState> = _state
 init{load()}
 fun load()=viewModelScope.launch{_state.value=CompanyState(loading=true,context=_state.value.context);_state.value=try{CompanyState(context=api.company(),loading=false)}catch(e:Exception){CompanyState(loading=false,message=error(e))}}
 fun saveOperations(data:OperationsSettings,onSuccess:()->Unit={})=save(onSuccess){api.updateOperations(data)}
 fun saveGeofence(data:GeofenceSettings,onSuccess:()->Unit={})=save(onSuccess){api.updateGeofence(data)}
 fun saveTravel(data:TravelRateSettings,onSuccess:()->Unit={})=save(onSuccess){api.updateTravel(data)}
 private fun save(onSuccess:()->Unit,block:suspend()->CompanyContext)=viewModelScope.launch{_state.value=_state.value.copy(saving=true,message=null);try{_state.value=CompanyState(context=block(),loading=false,message="Saved authoritative company settings.");onSuccess()}catch(e:Exception){_state.value=_state.value.copy(saving=false,message=error(e))}}
 private fun error(e:Exception)=apiMessage(e,"Company information couldn't be loaded.")
}
