package com.salespunch360.mobile.ui

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.apiMessage
import com.salespunch360.mobile.data.CompanyProfile
import com.salespunch360.mobile.data.CompanyProfileClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ReadOnlyCompanyState(val loading:Boolean=true,val company:CompanyProfile?=null,val error:String?=null)
class ReadOnlyCompanyViewModel(app:Application):AndroidViewModel(app){
 private val client=CompanyProfileClient(SecureSession(app))
 private val _state=MutableStateFlow(ReadOnlyCompanyState())
 val state:StateFlow<ReadOnlyCompanyState> = _state
 init{load()}
 fun load(){viewModelScope.launch{_state.value=_state.value.copy(loading=true,error=null);try{_state.value=ReadOnlyCompanyState(false,client.loadReadOnly())}catch(e:Exception){_state.value=_state.value.copy(loading=false,error=apiMessage(e,"Company details couldn't be loaded."))}}}
}
@Composable fun ReadOnlyCompanyDetailsScreen(vm:ReadOnlyCompanyViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 val company=state.company
 if(company==null){if(state.loading)LoadingScreen("Loading company details…")else RetryScreen(state.error?:"Company details couldn't be loaded.",vm::load);return}
 val fields=listOf("Business name" to company.name,"Address" to listOfNotNull(company.addressLine1,company.addressLine2,company.locality,company.city,company.state,company.postalCode,company.country).filter{it.isNotBlank()}.joinToString(", "),"Contact person" to company.primaryContactName,"Phone" to company.primaryPhone,"Alternate phone" to company.alternatePhone,"Email" to company.contactEmail,"Website" to company.website,"GSTIN" to company.gstin,"PAN" to company.pan,"Registration number" to company.registrationNumber,"Description" to company.description,"Team structure" to company.teamStructure.name.replace('_',' '),"Enabled modules" to company.enabledModules.joinToString(", "))
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Company Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Text("Your company's authoritative business details (view only).",color=SalesMuted);OutlinedButton(vm::load,enabled=!state.loading){Text(if(state.loading)"Refreshing…" else "Refresh")};state.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}}
  fields.forEach{(label,value)->item(key=label){ContentCard(label,value?.takeIf{it.isNotBlank()}?:"Not provided")}}
 }
}
