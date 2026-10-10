package com.salespunch360.mobile.ui.account.project
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountProjectViewModel
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.*
@Composable
fun ProjectActionsScreen(padding:PaddingValues,navigate:(String)->Unit,back:()->Unit,vm:AccountProjectViewModel=viewModel()) {
    val state=vm.state.collectAsStateWithLifecycle().value
    var projectId by remember{mutableStateOf("")};var open by remember{mutableStateOf(false)}
    val project=state.rows.firstOrNull{it.str("id")==projectId && it.str("status") !in listOf("COMPLETED","CLOSED","CANCELLED")}
    val capabilities=state.options["capabilities"]?.jsonObject?.get("workflow")?.jsonObject
    fun can(key:String)=capabilities?.get(key)?.jsonPrimitive?.booleanOrNull==true
    Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Row{TextButton(back){Text("‹ Back")};Text("Project Actions",style=MaterialTheme.typography.headlineSmall)}
        Box{OutlinedButton({open=true},Modifier.fillMaxWidth()){Text(project?.str("name")?:"Select Project")};DropdownMenu(open,{open=false}){state.rows.filter{it.str("status") !in listOf("COMPLETED","CLOSED","CANCELLED")}.forEach{row->DropdownMenuItem({Text(row.str("name"))},{projectId=row.str("id");open=false})}}}
        state.error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        listOf(
            Triple("Advance / installment","/workspace/account/transactions/money?type=CUSTOMER_ADVANCE","paymentIn"),
            Triple("Purchase materials","/workspace/account/transactions/new?type=PURCHASE_BILL&purchaseFor=PROJECT","purchase"),
            Triple("Labour / other expense","/workspace/account/expenses/new?context=project","expense"),
            Triple("Move leftover materials","/workspace/account/projects/material?mode=project","material"),
            Triple("Extra job","/workspace/account/projects/$projectId/costing","extraJob"),
            Triple("Profit / loss","/workspace/account/projects/$projectId/costing#report","report"),
            Triple("Close Project","/workspace/account/projects/$projectId","")
        ).filter{(_,_,key)->key.isEmpty()||can(key)}.forEach{(label,path,_)->
            OutlinedButton(enabled=project!=null,onClick={navigate(path+(if(path.contains("?"))"&" else "?")+"projectId=$projectId")},modifier=Modifier.fillMaxWidth()){Text(label)}
        }
    }
}
