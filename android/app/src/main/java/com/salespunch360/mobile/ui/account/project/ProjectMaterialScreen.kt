package com.salespunch360.mobile.ui.account.project
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.ProjectMaterialViewModel
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.ui.account.sales.SelectField
@Composable fun ProjectMaterialScreen(padding:PaddingValues,initialProjectId:String?=null,vm:ProjectMaterialViewModel=viewModel()){
 LaunchedEffect(initialProjectId){vm.initialRoute(initialProjectId)}
 val s=vm.state.collectAsStateWithLifecycle().value
 val labels=mapOf("ISSUE" to "Issue inventory","CONSUME" to "Consume","RETURN" to "Return to inventory","TRANSFER" to "Transfer Project","REVERSE" to "Reverse movement")
 val branch=s.projects.find{it.str("id")==s.projectId}?.str("branchId")
 LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
 item{Text("Project Material",style=MaterialTheme.typography.headlineSmall)}
 if(s.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
 s.error?.let{item{Text(it,color=MaterialTheme.colorScheme.error);TextButton(onClick={vm.refresh()}){Text("Reload current balances")}}}
 s.message?.let{item{Text(it,color=MaterialTheme.colorScheme.primary)}}
 if(s.allowedActions.isEmpty()&&!s.loading)item{Text("Read-only Project material access")}
 else if(s.allowedActions.isNotEmpty()){
 item{SelectField("Action",s.action,s.allowedActions.map{it to labels.getValue(it)}){v->vm.update{it.copy(action=v)}}}
 if(s.action=="REVERSE")item{SelectField("Movement to reverse",s.movementId,s.movements.filter{it.str("isReversed")!="true"&&it.str("movementType") !in listOf("REVERSAL","TRANSFER_IN","DIRECT_PROJECT_RECEIPT","RETURN_TO_VENDOR")}.map{it.str("id") to "${it.str("movementType").replace('_',' ')} · ${it.str("quantity")} · ${it.str("movementDate").take(10)}"}){v->vm.update{it.copy(movementId=v)}}}
 else{
 item{SelectField(if(s.action=="TRANSFER")"Source Project" else "Project",s.projectId,s.projects.map{it.str("id") to "${it.str("projectNumber")} · ${it.str("name")}"}){v->vm.selectProject(v)}}
 if(s.action=="TRANSFER")item{SelectField("Destination Project",s.destinationProjectId,s.projects.filter{it.str("id")!=s.projectId&&it.str("branchId")==branch}.map{it.str("id") to it.str("name")}){v->vm.update{it.copy(destinationProjectId=v)}}}
 if(s.action=="ISSUE"){
 item{SelectField("Product",s.productId,s.products.map{it.str("id") to it.str("name")}){v->vm.selectProduct(v)}}
 if(s.products.find{it.str("id")==s.productId}?.str("trackingMode")=="BATCH")item{SelectField("Batch",s.batchId,s.batches.map{it.str("id") to "${it.str("batchNumber")} ${it.str("expiryDate").take(10)}"}){v->vm.update{it.copy(batchId=v)}}}
 if(s.products.find{it.str("id")==s.productId}?.str("trackingMode")=="SERIAL")item{SelectField("Serial number",s.serialNumberId,s.serialNumbers.map{it.str("id") to "${it.str("serialNumber")} ${it.str("expiryDate").take(10)}"}){v->vm.update{it.copy(serialNumberId=v)}}}
 item{SelectField("Budget line (optional)",s.budgetLineId,s.budgetLines.filter{it.str("projectId")==s.projectId}.map{it.str("id") to it.str("title")}){v->vm.update{it.copy(budgetLineId=v)}}}
 }else item{SelectField("Available receipt",s.sourceMovementId,s.sources.filter{it.str("projectId")==s.projectId&&it.str("isReversed")!="true"&&(it.str("availableQuantity").toBigDecimalOrNull()?.signum()?:0)>0}.map{it.str("id") to "${it.str("productName")} · available ${it.str("availableQuantity")} · ₹${it.str("originalUnitCost")}/unit"}){v->vm.update{it.copy(sourceMovementId=v)}}}
 if(s.action in listOf("ISSUE","RETURN"))item{SelectField("Warehouse",s.warehouseId,s.warehouses.filter{it.str("branchId")==branch}.map{it.str("id") to it.str("name")}){v->vm.update{it.copy(warehouseId=v)}}}
 item{OutlinedTextField(s.quantity,{v->vm.update{it.copy(quantity=v)}},enabled=!s.saving,label={Text("Quantity")},modifier=Modifier.fillMaxWidth())}
 }
 item{OutlinedTextField(s.movementDate,{v->vm.update{it.copy(movementDate=v)}},enabled=!s.saving,label={Text("Effective date (YYYY-MM-DD)")},modifier=Modifier.fillMaxWidth())}
 if(s.action in listOf("RETURN","TRANSFER","REVERSE"))item{OutlinedTextField(s.reason,{v->vm.update{it.copy(reason=v)}},enabled=!s.saving,label={Text("Reason")},modifier=Modifier.fillMaxWidth())}
 if(s.action!="REVERSE")item{OutlinedTextField(s.notes,{v->vm.update{it.copy(notes=v)}},enabled=!s.saving,label={Text("Notes")},modifier=Modifier.fillMaxWidth())}
 item{Button(vm::post,enabled=!s.saving&&!s.loading,modifier=Modifier.fillMaxWidth()){Text(if(s.saving)"Posting…" else "Post movement")}}
 }
 item{Text("Receipt page ${s.sourcePage} of ${s.sourcePages}");Row{TextButton(onClick={vm.refresh(s.sourcePage-1,s.historyPage)},enabled=s.sourcePage>1&&!s.loading&&!s.saving){Text("Previous receipts")};TextButton(onClick={vm.refresh(s.sourcePage+1,s.historyPage)},enabled=s.sourcePage<s.sourcePages&&!s.loading&&!s.saving){Text("Next receipts")}}}
 item{Text("Movement history",style=MaterialTheme.typography.titleLarge)}
 items(s.movements,key={it.str("id")}){m->ListItem(headlineContent={Text(m.str("movementType").replace('_',' '))},supportingContent={Text("${m.str("movementDate").take(10)} · Qty ${m.str("quantity")}${if(m.str("isReversed")=="true")" · Reversed" else ""}")},trailingContent={Text("₹${m.str("totalCost")}")})}
 item{Text("History ${s.historyPage} of ${s.historyPages}");Row{TextButton(onClick={vm.refresh(s.sourcePage,s.historyPage-1)},enabled=s.historyPage>1&&!s.loading&&!s.saving){Text("Previous history")};TextButton(onClick={vm.refresh(s.sourcePage,s.historyPage+1)},enabled=s.historyPage<s.historyPages&&!s.loading&&!s.saving){Text("Next history")}}}
 }
}
