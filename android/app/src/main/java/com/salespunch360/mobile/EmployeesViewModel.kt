package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class EmployeesState(val loading:Boolean=true,val context:EmployeeContext?=null,val error:String?=null,val mutating:Boolean=false,val notice:String?=null)
class EmployeesViewModel(app:Application):AndroidViewModel(app){private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(EmployeesState());val state:StateFlow<EmployeesState> = _state
 init{refresh()}
 fun refresh()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,error=null);try{_state.value=EmployeesState(false,api.employees())}catch(e:Exception){_state.value=_state.value.copy(loading=false,error=if(e is IOException)"You're offline. Reconnect and try again." else "Employees couldn't be loaded. Please try again.")}}
 fun create(request:CreateEmployeeRequest,onSuccess:()->Unit){if(_state.value.mutating)return;viewModelScope.launch{_state.value=_state.value.copy(mutating=true,error=null);try{api.createEmployee(request);val context=api.employees();_state.value=EmployeesState(false,context,notice="Employee created.");onSuccess()}catch(e:Exception){_state.value=_state.value.copy(mutating=false,error=message(e))}}}
 fun setActive(employee:Employee,active:Boolean){if(_state.value.mutating)return;viewModelScope.launch{_state.value=_state.value.copy(mutating=true,error=null);try{api.setEmployeeActive(employee.id,active);_state.value=EmployeesState(false,api.employees(),notice=if(active)"${employee.name} reactivated." else "${employee.name} deactivated.")}catch(e:Exception){_state.value=_state.value.copy(mutating=false,error=message(e))}}}
 fun dismiss(){_state.value=_state.value.copy(error=null,notice=null)}
 private fun message(e:Exception)=when((e as? ApiException)?.code){"SEAT_LIMIT"->"No seat is available for this role.";"LIFECYCLE_BLOCKED"->"Your entitlement currently blocks employee changes.";"MANAGERS_DISABLED"->"Managers aren't available for this company structure.";"INVALID_MANAGER"->"Choose an active Manager from your company.";"INVALID_INPUT"->"Check the employee details and try again.";"FORBIDDEN"->"Employee management requires a Company Admin account.";else->if(e is IOException)"You're offline. Reconnect before making changes." else "The change couldn't be completed."}
}
