package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
data class FieldState(val loading:Boolean=true,val context:FieldContext?=null,val leads:List<LeadSummary> = emptyList(),val busy:Boolean=false,val message:String?=null)
class FieldViewModel(app:Application):AndroidViewModel(app){private val session=SecureSession(app);private val api=ApiClient(session);private val _state=MutableStateFlow(FieldState());val state:StateFlow<FieldState> = _state;init{refresh()}
 fun refresh()=viewModelScope.launch{_state.value=_state.value.copy(loading=true);_state.value=try{FieldState(false,api.fieldContext(),api.leads().filter{it.assignedUserId==session.userId()})}catch(_:Exception){_state.value.copy(loading=false,message="Field information couldn't be loaded.")}}
 fun checkIn(type:String,subjectId:String?,name:String?,phone:String?,location:LocationPayload,notes:String?,photo:ByteArray?,followUpTaskId:String?=null){mutate("Checked in."){api.checkIn(type,subjectId,name,phone,location,notes,photo,followUpTaskId)}}
 fun checkout(visitId:String,location:LocationPayload,sentiment:VisitSentiment,remarks:String?){mutate("Checkout completed."){api.checkout(visitId,location,sentiment,remarks)}}
 fun createLead(visitId:String,title:String){mutate("Lead created from visit."){api.leadFromVisit(visitId,title)}}
 fun locationError(message:String){_state.value=_state.value.copy(message=message)}
 fun clear(){_state.value=_state.value.copy(message=null)}
 private fun mutate(success:String,action:suspend()->Unit){if(_state.value.busy)return;viewModelScope.launch{_state.value=_state.value.copy(busy=true,message=null);try{action();_state.value=FieldState(false,api.fieldContext(),api.leads().filter{it.assignedUserId==session.userId()},message=success)}catch(e:ApiException){_state.value=_state.value.copy(busy=false,message=when(e.code){"ATTENDANCE_REQUIRED"->"Start attendance before checking in.";"CHECKOUT_REQUIRED"->"Complete your current checkout first.";"REPEAT_VISIT_OUTSIDE_RADIUS"->"You are outside the allowed 50 m check-in radius. Current distance: ${e.distanceMeters?.toInt()?:"unknown"} m.";"PHOTO_REQUIRED"->"A photo is required for this check-in.";"PHOTO_INVALID"->"Unable to process this photo. Please take it again.";"PHOTO_STORAGE_NOT_CONFIGURED"->"Photo storage is not configured. Contact your administrator.";"PHOTO_STORAGE_UNAVAILABLE"->"Photo storage is temporarily unavailable.";"SUBJECT_OWNERSHIP_CONFLICT"->"This subject requires assignment resolution.";"OUTSIDE_RADIUS"->"You are outside the configured customer area.";"INSUFFICIENT_ACCURACY"->"Location accuracy isn't sufficient. Try again outdoors.";else->apiMessage(e,"The action couldn't be completed.")})}catch(_:Exception){_state.value=_state.value.copy(busy=false,message="Check your connection and location, then try again.")}}}
}
