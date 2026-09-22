package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.CustomerReceiptViewModel

@Composable
fun CustomerReceiptScreen(padding: PaddingValues, vm: CustomerReceiptViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val customers = state.customers.filter { it.branchId == state.branchId }
    val invoices = state.invoices.filter { it.branchId == state.branchId && it.customerId == state.customerId }
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Text("Payment-In / Customer Receipt", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.error?.let { error -> item { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) { Row(Modifier.padding(12.dp)) { Text(error, Modifier.weight(1f)); TextButton(onClick = vm::refresh) { Text("Retry") } } } } }
        state.message?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.primary) } }
        item { SelectField("Branch", state.branchId, state.branches.map { it.id to it.name }) { id -> vm.update { it.copy(branchId = id, customerId = "", invoiceId = "") } } }
        item { SelectField("Customer", state.customerId, customers.map { it.id to it.name }) { id -> vm.update { it.copy(customerId = id, invoiceId = "") } } }
        item { SelectField("Invoice", state.invoiceId, invoices.map { it.id to "${it.number} · Outstanding ₹${it.outstanding}" }) { id -> val invoice = invoices.first { it.id == id }; vm.update { it.copy(invoiceId = id, amount = invoice.outstanding) } } }
        item { OutlinedTextField(state.amount, { value -> vm.update { it.copy(amount = value) } }, label = { Text("Amount") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(state.date, { value -> vm.update { it.copy(date = value) } }, label = { Text("Receipt date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth()) }
        item { SelectField("Payment method", state.mode, listOf("CASH" to "Cash", "BANK" to "Bank")) { value -> vm.update { it.copy(mode = value) } } }
        item { SelectField("Money account", state.moneyAccountId, state.moneyAccounts.filter { it.branchId == null || it.branchId == state.branchId }.map { it.id to it.name }) { value -> vm.update { it.copy(moneyAccountId = value) } } }
        item { OutlinedTextField(state.reference, { value -> vm.update { it.copy(reference = value) } }, label = { Text("Reference") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(state.notes, { value -> vm.update { it.copy(notes = value) } }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth()) }
        item { Button(onClick = vm::save, enabled = !state.saving && state.customerId.isNotBlank() && state.invoiceId.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text(if (state.saving) "Posting…" else "Post receipt") } }
        item { Text("Recent receipts", style = MaterialTheme.typography.titleLarge) }
        items(state.history, key = { it.id }) { row -> ListItem(headlineContent = { Text(row.number) }, supportingContent = { Text("${row.date} · ${row.mode}") }, trailingContent = { Text("₹${row.amount}") }) }
    }
}
