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
 if(state.loading&&state.branches.isEmpty()){LoadingScreen("Loading branches…");return}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Branches",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Button({creating=true}){Text("+ Add")}};state.message?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}
  items(state.branches,key={it.id}){branch->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("${branch.name} (${branch.code})",fontWeight=FontWeight.Bold);StatusChip(if(branch.isPrimary)"Primary Head Office" else if(branch.isActive)"Active" else "Inactive")};listOfNotNull(branch.addressLine1,branch.city,branch.state,branch.phone).takeIf{it.isNotEmpty()}?.let{Text(it.joinToString(" · "),style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton({editing=branch},Modifier.weight(1f)){Text("Edit")};if(!branch.isPrimary)TextButton({vm.setActive(branch)},enabled=!state.saving,modifier=Modifier.weight(1f)){Text(if(branch.isActive)"Deactivate" else "Activate")}}}}}
 }
 if(creating)BranchDialog(null,state.saving,{creating=false}){v->vm.create(v.name,v.code,v.addressLine1,v.city,v.state,v.postalCode,v.country,v.phone,v.email){creating=false}}
 editing?.let{branch->BranchDialog(branch,state.saving,{editing=null}){vm.edit(it){editing=null}}}
}

@Composable private fun BranchDialog(branch:BranchDetails?,busy:Boolean,dismiss:()->Unit,save:(BranchDetails)->Unit){
 var name by remember(branch?.id){mutableStateOf(branch?.name?:"")};var code by remember(branch?.id){mutableStateOf(branch?.code?:"")};var address by remember(branch?.id){mutableStateOf(branch?.addressLine1?:"")};var city by remember(branch?.id){mutableStateOf(branch?.city?:"")};var state by remember(branch?.id){mutableStateOf(branch?.state?:"")};var postal by remember(branch?.id){mutableStateOf(branch?.postalCode?:"")};var country by remember(branch?.id){mutableStateOf(branch?.country?:"India")};var phone by remember(branch?.id){mutableStateOf(branch?.phone?:"")};var email by remember(branch?.id){mutableStateOf(branch?.email?:"")}
 AlertDialog(onDismissRequest={if(!busy)dismiss()},title={Text(if(branch==null)"Add Branch" else "Edit Branch")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(7.dp)){OutlinedTextField(name,{name=it},label={Text("Name")});OutlinedTextField(code,{code=it.uppercase()},label={Text("Code")});OutlinedTextField(address,{address=it},label={Text("Address")});OutlinedTextField(city,{city=it},label={Text("City")});OutlinedTextField(state,{state=it},label={Text("State")});OutlinedTextField(postal,{postal=it},label={Text("Postal code")});OutlinedTextField(country,{country=it},label={Text("Country")});OutlinedTextField(phone,{phone=it},label={Text("Phone")});OutlinedTextField(email,{email=it},label={Text("Email")})}},confirmButton={Button({save(BranchDetails(branch?.id?:"",name.trim(),code.trim(),address.ifBlank{null},city.ifBlank{null},state.ifBlank{null},postal.ifBlank{null},country.ifBlank{null},phone.ifBlank{null},email.ifBlank{null},branch?.isPrimary?:false,branch?.isActive?:true))},enabled=!busy&&name.isNotBlank()&&code.isNotBlank()){Text(if(busy)"Saving…" else "Save")}},dismissButton={TextButton(dismiss){Text("Cancel")}})
}
