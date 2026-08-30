package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
data class ReportsState(val loading:Boolean=true,val type:String="attendance",val report:JsonObject?=null,val message:String?=null)
class ReportsViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ReportsState());val state:StateFlow<ReportsState> = _state;init{load("attendance")};fun load(type:String)=viewModelScope.launch{_state.value=ReportsState(true,type);_state.value=try{ReportsState(false,type,api.report(type))}catch(_:Exception){ReportsState(false,type,message="Report couldn't be loaded.")}}}
