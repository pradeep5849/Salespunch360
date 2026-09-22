package com.salespunch360.mobile.ui.account.purchase

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountPurchaseViewModel

@Composable
fun PurchaseScreen(initialType: String?, padding: PaddingValues, vm: AccountPurchaseViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialType) { if (initialType != null) vm.filter(initialType) }
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        Row {
            OutlinedTextField(state.query, vm::search, label = { Text("Search number or vendor") }, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            FilledIconButton(onClick = { vm.create(initialType ?: state.types.firstOrNull().orEmpty()) }, enabled = state.types.isNotEmpty()) { Icon(Icons.Default.Add, "New purchase") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            item { FilterChip(state.type == null, { vm.filter(null) }, { Text("All") }) }
            items(state.types) { type -> FilterChip(state.type == type, { vm.filter(type) }, { Text(type.replace('_', ' ')) }) }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { error ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Row(Modifier.padding(12.dp)) { Text(error, Modifier.weight(1f)); TextButton(onClick = vm::refresh) { Text("Retry") } }
            }
        }
        LazyColumn(Modifier.fillMaxSize()) {
            items(state.rows, key = { it.id }) { row ->
                ListItem(
                    headlineContent = { Text(row.number, fontWeight = FontWeight.Bold) },
                    supportingContent = { Text("${row.party} · ${row.date} · ${row.type.replace('_', ' ')}") },
                    trailingContent = { Column { Text("₹${row.total}"); Text(row.status) } },
                    modifier = Modifier.clickable { vm.open(row.id) }
                )
            }
        }
    }
    state.draft?.let { PurchaseEditor(it, state, vm) }
    state.detail?.let { PurchaseDetail(it, state.saving, vm::close, vm::askPost) }
    state.posting?.let {
        AlertDialog(
            onDismissRequest = vm::cancelPost,
            title = { Text("Post purchase document?") },
            text = { Text("The server will validate the financial year, period lock, tax, stock, and ledger posting.") },
            confirmButton = { Button(onClick = vm::post) { Text("Post") } },
            dismissButton = { TextButton(onClick = vm::cancelPost) { Text("Cancel") } }
        )
    }
}
