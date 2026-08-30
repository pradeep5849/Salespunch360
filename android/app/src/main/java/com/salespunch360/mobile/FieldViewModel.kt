package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
data class FieldState(val loading:Boolean=true,val context:FieldContext?=null,val busy:Boolean=false,val message:String?=null)
class FieldViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(FieldState());val state:StateFlow<FieldState> = _state;init{refresh()}
 fun refresh()=viewModelScope.launch{_state.value=_state.value.copy(loading=true);_state.value=try{FieldState(false,api.fieldContext())}catch(_:Exception){_state.value.copy(loading=false,message="Field information couldn't be loaded.")}}
 fun checkIn(customerId:String,location:LocationPayload,notes:String?){mutate("Checked in."){api.checkIn(customerId,location,notes)}}
 fun checkout(visitId:String,location:LocationPayload,sentiment:VisitSentiment,remarks:String?){mutate("Checkout completed."){api.checkout(visitId,location,sentiment,remarks)}}
 fun clear(){_state.value=_state.value.copy(message=null)}
 private fun mutate(success:String,action:suspend()->Unit){if(_state.value.busy)return;viewModelScope.launch{_state.value=_state.value.copy(busy=true,message=null);try{action();_state.value=FieldState(false,api.fieldContext(),message=success)}catch(e:ApiException){_state.value=_state.value.copy(busy=false,message=when(e.code){"ATTENDANCE_REQUIRED"->"Start attendance before checking in.";"CHECKOUT_REQUIRED"->"Complete your current checkout first.";"OUTSIDE_RADIUS"->"You are outside the customer check-in area.";"INSUFFICIENT_ACCURACY"->"Location accuracy isn't sufficient. Try again outdoors.";else->"The action couldn't be completed."})}catch(_:Exception){_state.value=_state.value.copy(busy=false,message="Check your connection and location, then try again.")}}}
}
