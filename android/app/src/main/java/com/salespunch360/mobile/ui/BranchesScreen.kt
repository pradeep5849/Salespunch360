package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.BranchesViewModel
import com.salespunch360.mobile.data.BranchDetails

@Composable fun BranchesScreen(vm:BranchesViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;var creating by remember{mutableStateOf(false)};var editing by remember{mutableStateOf<BranchDetails?>(null)}
 val updatePresentation=LocalSetBranchUiEnabled.current
 LaunchedEffect(state.loading,state.branches){if(!state.loading&&state.branches.isNotEmpty())updatePresentation(state.branches.size>1)}
 if(state.loading&&state.branches.isEmpty()){LoadingScreen("Loading branches…");return}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(if(LocalBranchUiEnabled.current)"Branches" else "Add Branch",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Row{TextButton({vm.load()},enabled=!state.saving&&!state.loading){Text("Refresh")};Button({vm.clearMessage();creating=true},enabled=!state.saving&&!state.loading){Text("+ Add")}}};state.message?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}
  items(if(state.branches.size==1&&state.branches[0].isPrimary)emptyList()else state.branches,key={it.id}){branch->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("${branch.name} (${branch.code})",fontWeight=FontWeight.Bold);StatusChip(if(branch.isPrimary)"Primary Head Office" else if(branch.isActive)"Active" else "Inactive")};listOfNotNull(branch.addressLine1,branch.city,branch.state,branch.phone).takeIf{it.isNotEmpty()}?.let{Text(it.joinToString(" · "),style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton({vm.clearMessage();editing=branch},Modifier.weight(1f),enabled=!state.saving){Text("Edit")};if(!branch.isPrimary)TextButton({vm.setActive(branch)},enabled=!state.saving,modifier=Modifier.weight(1f)){Text(if(branch.isActive)"Deactivate" else "Activate")}}}}}
 }
 if(creating)BranchDialog(null,state.saving,state.message,{creating=false},firstAdditional=state.branches.size==1&&state.branches[0].isPrimary){v,choice->vm.create(v.name,v.code,v.addressLine1,v.city,v.state,v.postalCode,v.country,v.phone,v.email,choice){creating=false}}
 editing?.let{branch->BranchDialog(branch,state.saving,state.message,{editing=null}){value,_->vm.edit(value){editing=null}}}
}

@Composable private fun BranchDialog(branch:BranchDetails?,busy:Boolean,error:String?,dismiss:()->Unit,firstAdditional:Boolean=false,save:(BranchDetails,String?)->Unit){
 var firstAction by remember(branch?.id,firstAdditional){mutableStateOf<String?>(null)}
 var name by remember(branch?.id){mutableStateOf(branch?.name?:"")};var code by remember(branch?.id){mutableStateOf(branch?.code?:"")};var address by remember(branch?.id){mutableStateOf(branch?.addressLine1?:"")};var city by remember(branch?.id){mutableStateOf(branch?.city?:"")};var state by remember(branch?.id){mutableStateOf(branch?.state?:"")};var postal by remember(branch?.id){mutableStateOf(branch?.postalCode?:"")};var country by remember(branch?.id){mutableStateOf(branch?.country?:"India")};var phone by remember(branch?.id){mutableStateOf(branch?.phone?:"")};var email by remember(branch?.id){mutableStateOf(branch?.email?:"")}
 AlertDialog(onDismissRequest={if(!busy)dismiss()},title={Text(if(branch==null)"Add Branch" else "Edit Branch")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(7.dp)){error?.let{Text(it,color=MaterialTheme.colorScheme.error)};if(firstAdditional){Text("Existing business",fontWeight=FontWeight.Bold);listOf("KEEP_HEAD_OFFICE" to "Keep existing business in Head Office; new branch starts empty","MOVE_EXISTING" to "Use existing business as this branch; Head Office starts empty").forEach{(key,label)->Row{RadioButton(selected=firstAction==key,onClick={firstAction=key},enabled=!busy);TextButton(onClick={firstAction=key},enabled=!busy,modifier=Modifier.weight(1f)){Text(label)}}};Text("Existing record history is retained.")};OutlinedTextField(name,{name=it},enabled=!busy,label={Text("Name")});OutlinedTextField(code,{code=it.uppercase()},enabled=!busy,label={Text("Code")});OutlinedTextField(address,{address=it},enabled=!busy,label={Text("Address")});OutlinedTextField(city,{city=it},enabled=!busy,label={Text("City")});OutlinedTextField(state,{state=it},enabled=!busy,label={Text("State")});OutlinedTextField(postal,{postal=it},enabled=!busy,label={Text("Postal code")});OutlinedTextField(country,{country=it},enabled=!busy,label={Text("Country")});OutlinedTextField(phone,{phone=it},enabled=!busy,label={Text("Phone")});OutlinedTextField(email,{email=it},enabled=!busy,label={Text("Email")})}},confirmButton={Button({save(BranchDetails(branch?.id?:"",name.trim(),code.trim(),address.ifBlank{null},city.ifBlank{null},state.ifBlank{null},postal.ifBlank{null},country.ifBlank{null},phone.ifBlank{null},email.ifBlank{null},branch?.isPrimary?:false,branch?.isActive?:true),if(firstAdditional)firstAction else null)},enabled=!busy&&(!firstAdditional||firstAction!=null)&&name.trim().length in 2..120&&code.trim().length in 1..20){Text(if(busy)"Saving…" else "Save")}},dismissButton={TextButton(dismiss,enabled=!busy){Text("Cancel")}})
}
