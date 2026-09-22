package com.salespunch360.mobile.ui.account.sales

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
import com.salespunch360.mobile.AccountSalesViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSalesScreen(initialType: String?, padding: PaddingValues, vm: AccountSalesViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialType) { if (initialType != null) vm.filter(initialType) }
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(state.query, vm::search, label = { Text("Search number or customer") }, singleLine = true, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            FilledIconButton(onClick = { vm.newDocument(initialType ?: state.options.types.firstOrNull().orEmpty()) }, enabled = state.options.types.isNotEmpty()) { Icon(Icons.Default.Add, "New document") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { FilterChip(state.typeFilter == null, { vm.filter(null) }, { Text("All") }) }
            items(state.options.types) { type -> FilterChip(state.typeFilter == type, { vm.filter(type) }, { Text(type.replace('_', ' ')) }) }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { error ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Row(Modifier.padding(12.dp)) { Text(error, Modifier.weight(1f)); TextButton(onClick = vm::refresh) { Text("Retry") } }
            }
        }
        state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(8.dp)) }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (!state.loading && state.rows.isEmpty()) item { Text("No sales documents found.", Modifier.padding(24.dp)) }
            items(state.rows, key = { it.id }) { row ->
                ElevatedCard(Modifier.fillMaxWidth().clickable { vm.open(row.id) }) {
                    ListItem(
                        headlineContent = { Text(row.number.ifBlank { "Draft" }, fontWeight = FontWeight.Bold) },
                        supportingContent = { Text("${row.party} · ${row.date} · ${row.type.replace('_', ' ')}") },
                        trailingContent = { Column { Text("₹${row.total}"); Text(row.status, style = MaterialTheme.typography.labelSmall) } }
                    )
                }
            }
        }
    }
    state.editor?.let { SalesDocumentEditor(it, state.options, state.saving, vm::editDraft, vm::addLine, vm::updateLine, vm::removeLine, vm::closeEditor, vm::save) }
    state.detail?.let { SalesDocumentDetail(it, state.saving, vm::closeDetail, vm::requestPost) }
    state.postingId?.let {
        AlertDialog(
            onDismissRequest = vm::cancelPost,
            title = { Text("Post document?") },
            text = { Text("Posting is authoritative and may create ledger and stock movements. This requires server confirmation.") },
            confirmButton = { Button(onClick = vm::confirmPost) { Text("Post") } },
            dismissButton = { TextButton(onClick = vm::cancelPost) { Text("Cancel") } }
        )
    }
}
