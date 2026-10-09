package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.CustomerReceiptViewModel

@Composable
fun CustomerReceiptScreen(padding: PaddingValues, initialProjectId:String?=null, requestedType:String?=null, vm: CustomerReceiptViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(state.loading,initialProjectId,requestedType){vm.initialRoute(initialProjectId,requestedType)}
    val customers = state.customers.filter { it.branchId == state.branchId }
    val projects = state.projects.filter { it.branchId == state.branchId && state.projectCustomers[it.id] == state.customerId }
    val invoices = state.invoices.filter { it.branchId == state.branchId && it.customerId == state.customerId && it.projectId == state.projectId }
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Text("Payment-In / Advances", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.error?.let { error -> item { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) { Row(Modifier.padding(12.dp)) { Text(error, Modifier.weight(1f)); TextButton(onClick = vm::refresh) { Text("Retry") } } } } }
        state.message?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.primary) } }
        item { SelectField("Payment function",state.type,state.allowedTypes.map{it to when(it){"CUSTOMER_ADVANCE"->"Customer advance";"APPLY_ADVANCE"->"Apply advance to invoice";else->"Customer receipt"}}){value->vm.update{it.copy(type=value,invoiceId="",advanceId="",amount="")}} }
        item { SelectField("Branch", state.branchId, state.branches.map { it.id to it.name }) { id -> vm.update { it.copy(branchId = id, customerId = "", projectId="", invoiceId = "",advanceId="") } } }
        item { SelectField("Customer", state.customerId, customers.map { it.id to it.name }) { id -> vm.update { it.copy(customerId = id,projectId="",invoiceId = "",advanceId="") } } }
        item { SelectField("Project", state.projectId, listOf("" to "Non-project") + projects.map { it.id to it.name }) { id -> vm.update { it.copy(projectId = id, invoiceId = "",advanceId="") } } }
        if(state.type!="CUSTOMER_ADVANCE") item { SelectField("Invoice", state.invoiceId, invoices.map { it.id to "${it.number} · Outstanding ₹${it.outstanding}" }) { id -> val invoice = invoices.first { it.id == id }; vm.update { it.copy(invoiceId = id, amount = invoice.outstanding) } } }
        if(state.type=="APPLY_ADVANCE")item{SelectField("Unused advance",state.advanceId,state.advances.filter{it.branchId==state.branchId&&it.customerId==state.customerId&&it.projectId==state.projectId}.map{it.id to "${it.number} · remaining ₹${it.remaining}"}){value->vm.update{it.copy(advanceId=value)}}}
        item { OutlinedTextField(state.amount, { value -> vm.update { it.copy(amount = value) } }, label = { Text("Amount") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(state.date, { value -> vm.update { it.copy(date = value) } }, label = { Text("Receipt date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth()) }
        if(state.type!="APPLY_ADVANCE")item { SelectField("Payment method", state.mode, listOf("CASH" to "Cash", "BANK" to "Bank")) { value -> vm.update { it.copy(mode = value) } } }
        if(state.type!="APPLY_ADVANCE")item { SelectField("Money account", state.moneyAccountId, state.moneyAccounts.filter { it.branchId == null || it.branchId == state.branchId }.map { it.id to it.name }) { value -> vm.update { it.copy(moneyAccountId = value) } } }
        if(state.type!="APPLY_ADVANCE")item { OutlinedTextField(state.reference, { value -> vm.update { it.copy(reference = value) } }, label = { Text("Reference") }, modifier = Modifier.fillMaxWidth()) }
        if(state.type!="APPLY_ADVANCE")item { OutlinedTextField(state.notes, { value -> vm.update { it.copy(notes = value) } }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth()) }
        item { Button(onClick = vm::save, enabled = !state.saving && !state.loading && state.type in state.allowedTypes && state.customerId.isNotBlank() && (state.type=="CUSTOMER_ADVANCE" || state.invoiceId.isNotBlank()), modifier = Modifier.fillMaxWidth()) { Text(if (state.saving) "Posting…" else if(state.type=="APPLY_ADVANCE")"Apply advance" else if(state.type=="CUSTOMER_ADVANCE")"Post advance" else "Post receipt") } }
        item { Text("Recent receipts and advances", style = MaterialTheme.typography.titleLarge) }
        items(state.history, key = { it.id }) { row -> ListItem(headlineContent = { Text(row.number) }, supportingContent = { Text("${row.date} · ${row.mode}") }, trailingContent = { Text("₹${row.amount}") }) }
    }
}
