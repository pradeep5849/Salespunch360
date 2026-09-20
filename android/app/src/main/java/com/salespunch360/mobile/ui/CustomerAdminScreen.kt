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
import com.salespunch360.mobile.CustomerAdminViewModel
import com.salespunch360.mobile.data.*

@Composable fun CustomerAdminScreen(vm:CustomerAdminViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;val context=state.context;var adding by remember{mutableStateOf(false)}
 if(state.loading&&context==null){LoadingScreen("Loading customers…");return};if(context==null){RetryScreen(state.message?:"Customers unavailable.",vm::load);return}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column{Text("Customers",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Text("Unassigned customer queue",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Button({adding=true}){Text("+ Add")}};state.message?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}
  if(context.customers.isEmpty())item{ContentCard("No unassigned customers","All customers are assigned or no customers have been added.")}
  items(context.customers,key={it.id}){customer->CustomerAssignmentCard(customer,context,state.saving){userId->vm.assign(customer.id,userId)}}
 }
 if(adding)AddCustomerDialog(context,state.saving,{adding=false}){request->vm.create(request){adding=false}}
}

@Composable private fun CustomerAssignmentCard(customer:CustomerAdminItem,context:CustomerAdminContext,busy:Boolean,assign:(String)->Unit){var selected by remember(customer.id){mutableStateOf<String?>(null)};var expanded by remember{mutableStateOf(false)};val eligible=context.assignees.filter{it.branchAccessScope=="ALL_BRANCHES"||it.branchAccesses.any{access->access.branchId==customer.branchId}}
 OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Text(customer.name,fontWeight=FontWeight.Bold);Text(customer.phone?:"No phone number",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Box{OutlinedButton({expanded=true},Modifier.fillMaxWidth()){Text(eligible.firstOrNull{it.id==selected}?.name?:"Assign to")};DropdownMenu(expanded,{expanded=false}){eligible.forEach{user->DropdownMenuItem({Text("${user.name} · ${if(user.salesRole==MobileRole.MANAGER)"Field Manager" else "Sales"}")},{selected=user.id;expanded=false})}}};Button({selected?.let(assign)},enabled=!busy&&selected!=null,modifier=Modifier.fillMaxWidth()){Text("Assign & Create Lead")}}}
}

@Composable private fun AddCustomerDialog(context:CustomerAdminContext,busy:Boolean,dismiss:()->Unit,save:(CreateCustomerRequest)->Unit){var name by remember{mutableStateOf("")};var phone by remember{mutableStateOf("")};var branchId by remember{mutableStateOf(context.branches.firstOrNull{it.isPrimary}?.id?:context.branches.firstOrNull()?.id)};var assigneeId by remember{mutableStateOf<String?>(null)};var branchesOpen by remember{mutableStateOf(false)};var usersOpen by remember{mutableStateOf(false)};val eligible=context.assignees.filter{user->branchId==null||user.branchAccessScope=="ALL_BRANCHES"||user.branchAccesses.any{it.branchId==branchId}}
 AlertDialog(onDismissRequest={if(!busy)dismiss()},title={Text("Add Customer")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){OutlinedTextField(name,{name=it},label={Text("Customer name")},modifier=Modifier.fillMaxWidth());OutlinedTextField(phone,{phone=it},label={Text("Phone")},modifier=Modifier.fillMaxWidth());Box{OutlinedButton({branchesOpen=true},Modifier.fillMaxWidth()){Text(context.branches.firstOrNull{it.id==branchId}?.let{"${it.name} (${it.code})"}?:"Choose branch")};DropdownMenu(branchesOpen,{branchesOpen=false}){context.branches.forEach{branch->DropdownMenuItem({Text("${branch.name} (${branch.code})")},{branchId=branch.id;assigneeId=null;branchesOpen=false})}}};Box{OutlinedButton({usersOpen=true},Modifier.fillMaxWidth()){Text(eligible.firstOrNull{it.id==assigneeId}?.name?:"Create unassigned")};DropdownMenu(usersOpen,{usersOpen=false}){DropdownMenuItem({Text("Create unassigned")},{assigneeId=null;usersOpen=false});eligible.forEach{user->DropdownMenuItem({Text(user.name)},{assigneeId=user.id;usersOpen=false})}}}}},confirmButton={Button({save(CreateCustomerRequest(name.trim(),phone.trim(),assigneeId,branchId))},enabled=!busy&&name.trim().length>=2&&phone.isNotBlank()){Text(if(busy)"Saving…" else "Save")}},dismissButton={TextButton(dismiss){Text("Cancel")}})
}
