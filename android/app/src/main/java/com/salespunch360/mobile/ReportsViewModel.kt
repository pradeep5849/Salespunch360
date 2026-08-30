package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
data class ReportsState(val loading:Boolean=true,val type:String="attendance",val report:JsonObject?=null,val start:String="",val end:String="",val employeeId:String?=null,val message:String?=null)
class ReportsViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ReportsState());val state:StateFlow<ReportsState> = _state;init{load("attendance")};fun load(type:String=_state.value.type)=viewModelScope.launch{val current=_state.value;_state.value=current.copy(loading=true,type=type,message=null);_state.value=try{val report=api.report(type,current.start.ifBlank{null},current.end.ifBlank{null},current.employeeId);val filters=report["filters"]?.jsonObject;current.copy(loading=false,type=type,report=report,start=filters?.get("startText")?.jsonPrimitive?.contentOrNull?:current.start,end=filters?.get("endText")?.jsonPrimitive?.contentOrNull?:current.end)}catch(e:Exception){current.copy(loading=false,type=type,message=apiMessage(e,"Report couldn't be loaded."))}};fun setStart(v:String){_state.value=_state.value.copy(start=v)};fun setEnd(v:String){_state.value=_state.value.copy(end=v)};fun setEmployee(v:String?){_state.value=_state.value.copy(employeeId=v)};fun reset(){_state.value=_state.value.copy(start="",end="",employeeId=null);load()}}
