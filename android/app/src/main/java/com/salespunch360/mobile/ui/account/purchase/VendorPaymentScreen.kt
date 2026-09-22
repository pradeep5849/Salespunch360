package com.salespunch360.mobile.ui.account.purchase

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
import com.salespunch360.mobile.VendorPaymentViewModel
import com.salespunch360.mobile.ui.account.sales.SelectField

@Composable
fun VendorPaymentScreen(padding: PaddingValues, vm: VendorPaymentViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val bills = state.bills.filter { it.branchId == state.branchId && it.vendorId == state.vendorId }
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Text("Payment-Out / Vendor Payment", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        item { SelectField("Branch", state.branchId, state.branches.map { it.id to it.name }) { id -> vm.update { it.copy(branchId = id, vendorId = "", billId = "") } } }
        item { SelectField("Vendor", state.vendorId, state.vendors.map { it.id to it.name }) { id -> vm.update { it.copy(vendorId = id, billId = "") } } }
        item { SelectField("Purchase bill", state.billId, bills.map { it.id to "${it.number} · Outstanding ₹${it.outstanding}" }) { id -> val bill = bills.first { it.id == id }; vm.update { it.copy(billId = id, amount = bill.outstanding) } } }
        item { OutlinedTextField(state.amount, { value -> vm.update { it.copy(amount = value) } }, label = { Text("Amount") }) }
        item { OutlinedTextField(state.date, { value -> vm.update { it.copy(date = value) } }, label = { Text("Payment date") }) }
        item { SelectField("Method", state.mode, listOf("CASH" to "Cash", "BANK" to "Bank")) { value -> vm.update { it.copy(mode = value) } } }
        item { SelectField("Money account", state.accountId, state.accounts.filter { it.branchId == null || it.branchId == state.branchId }.map { it.id to it.name }) { value -> vm.update { it.copy(accountId = value) } } }
        item { OutlinedTextField(state.reference, { value -> vm.update { it.copy(reference = value) } }, label = { Text("Reference") }) }
        item { OutlinedTextField(state.notes, { value -> vm.update { it.copy(notes = value) } }, label = { Text("Notes") }) }
        item { Button(onClick = vm::save, enabled = !state.saving && state.billId.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text(if (state.saving) "Posting…" else "Post payment") } }
        item { Text("Recent payments", style = MaterialTheme.typography.titleLarge) }
        items(state.history, key = { it.id }) { row ->
            ListItem(headlineContent = { Text(row.number) }, supportingContent = { Text("${row.date} · ${row.mode}") }, trailingContent = { Text("₹${row.amount}") })
        }
    }
}
