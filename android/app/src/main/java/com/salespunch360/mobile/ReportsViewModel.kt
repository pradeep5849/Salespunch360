package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
data class ReportsState(val loading:Boolean=true,val exporting:Boolean=false,val type:String="attendance",val report:JsonObject?=null,val start:String="",val end:String="",val employeeId:String?=null,val customerId:String?=null,val status:String="ALL",val sentiment:String="ALL",val page:Int=1,val export:ByteArray?=null,val message:String?=null)
class ReportsViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ReportsState());val state:StateFlow<ReportsState> = _state
 fun load(type:String=_state.value.type,page:Int=1)=viewModelScope.launch{val current=_state.value;_state.value=current.copy(loading=true,type=type,page=page,message=null);_state.value=try{val report=api.report(type,current.start.ifBlank{null},current.end.ifBlank{null},current.employeeId,current.customerId,current.status,current.sentiment,page);val filters=report["filters"]?.jsonObject;current.copy(loading=false,type=type,report=report,start=filters?.get("startText")?.jsonPrimitive?.contentOrNull?:current.start,end=filters?.get("endText")?.jsonPrimitive?.contentOrNull?:current.end,page=page)}catch(e:Exception){current.copy(loading=false,type=type,message=apiMessage(e,"Report couldn't be loaded."))}}
 fun exportExcel()=viewModelScope.launch{val current=_state.value;if(current.exporting)return@launch;_state.value=current.copy(exporting=true,export=null,message=null);_state.value=try{current.copy(exporting=false,export=api.reportExcel(current.type,current.start.ifBlank{null},current.end.ifBlank{null},current.employeeId,current.customerId,current.status,current.sentiment))}catch(e:Exception){current.copy(exporting=false,message=if(e is ApiException&&e.code=="REPORT_TOO_LARGE")"More than 10,000 rows match. Narrow the filters and try again." else apiMessage(e,"Excel export couldn't be downloaded."))}}
 fun consumeExport(){_state.value=_state.value.copy(export=null)}
 fun setStart(v:String){_state.value=_state.value.copy(start=v)};fun setEnd(v:String){_state.value=_state.value.copy(end=v)};fun setEmployee(v:String?){_state.value=_state.value.copy(employeeId=v)};fun setCustomer(v:String?){_state.value=_state.value.copy(customerId=v)};fun setStatus(v:String){_state.value=_state.value.copy(status=v)};fun setSentiment(v:String){_state.value=_state.value.copy(sentiment=v)};fun reset(){_state.value=_state.value.copy(start="",end="",employeeId=null,customerId=null,status="ALL",sentiment="ALL",page=1);load()}}
