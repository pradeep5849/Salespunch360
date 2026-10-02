package com.salespunch360.mobile.ui.account.project
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountProjectViewModel
import com.salespunch360.mobile.account.str
@Composable fun ProjectActionsScreen(padding:PaddingValues,navigate:(String)->Unit,back:()->Unit,vm:AccountProjectViewModel=viewModel()){val state=vm.state.collectAsStateWithLifecycle().value;var projectId by remember{mutableStateOf("")};var open by remember{mutableStateOf(false)};val project=state.rows.firstOrNull{it.str("id")==projectId};Column(Modifier.fillMaxSize().padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Row{TextButton(back){Text("‹ Back")};Text("Project Actions",style=MaterialTheme.typography.headlineSmall)};Box{OutlinedButton({open=true},Modifier.fillMaxWidth()){Text(project?.str("name")?:"Select Project")};DropdownMenu(open,{open=false}){state.rows.filter{it.str("status")!="CLOSED"&&it.str("status")!="CANCELLED"}.forEach{row->DropdownMenuItem({Text(row.str("name"))},{projectId=row.str("id");open=false})}}};listOf("Payment In" to "/workspace/account/transactions/money?type=CUSTOMER_RECEIPT","Purchase" to "/workspace/account/transactions/new?type=PURCHASE_BILL&purchaseFor=PROJECT","Expenses" to "/workspace/account/expenses/new?context=project","Materials" to "/workspace/account/projects/material?mode=project","Extra Job / Variation" to "/workspace/account/projects/$projectId/costing","Reports" to "/workspace/account/projects/$projectId/costing#report","Project Closing" to "/workspace/account/projects/$projectId").forEach{(label,path)->OutlinedButton(enabled=projectId.isNotBlank(),onClick={navigate(path+(if(path.contains("?"))"&" else "?")+"projectId=$projectId")},modifier=Modifier.fillMaxWidth()){Text(label)}}}}
