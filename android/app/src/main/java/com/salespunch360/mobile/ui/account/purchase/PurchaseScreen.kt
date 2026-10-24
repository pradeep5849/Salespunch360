package com.salespunch360.mobile.ui.account.purchase
import com.salespunch360.mobile.ui.account.accountDate

import com.salespunch360.mobile.ui.account.accountMoney
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
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.AccountPurchaseViewModel

@Composable
fun PurchaseScreen(initialType: String?, padding: PaddingValues, initialProjectId:String?=null, initialDocumentId:String?=null,initialOrderId:String?=null,navigate:(String)->Unit={}, vm: AccountPurchaseViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialDocumentId) { initialDocumentId?.let(vm::open) }
    LaunchedEffect(initialType) { if (initialType != null) vm.filter(initialType) }
    var initialEditorOpened by remember(initialType, initialProjectId,initialOrderId) { mutableStateOf(false) }
    LaunchedEffect(initialType, initialProjectId,initialOrderId, state.loading) {
        if (!initialEditorOpened && initialType != null && !state.loading && state.types.isNotEmpty()) {
            initialEditorOpened = true
            if(initialOrderId!=null)vm.prepareOrder(initialOrderId)else vm.create(initialType, initialProjectId)
        }
    }
    DisposableEffect(initialOrderId){onDispose{vm.cancelOrderPreparation()}}
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        if(initialOrderId!=null&&state.error!=null&&state.draft==null)TextButton(onClick={vm.prepareOrder(initialOrderId)},enabled=!state.loading){Text("Reload order")}
        Row {
            OutlinedTextField(state.query, vm::search, label = { Text("Search number or vendor") }, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            FilledIconButton(onClick = { vm.create(initialType ?: state.types.firstOrNull().orEmpty()) }, enabled = state.types.isNotEmpty()) { Icon(Icons.Default.Add, "New purchase") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            item { FilterChip(state.type == null, { vm.filter(null) }, { Text("All") }) }
            items(state.types) { type -> FilterChip(state.type == type, { vm.filter(type) }, { Text(type.replace('_', ' ')) }) }
        }
        state.message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
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
                    supportingContent = { Text("${row.party} · ${accountDate(row.date)} · ${row.type.replace('_', ' ')}") },
                    trailingContent = { Column { Text(accountMoney(row.total)); Text(row.status) } },
                    modifier = Modifier.clickable { vm.open(row.id) }
                )
            }
        }
    }
    state.draft?.let { PurchaseEditor(it, state, vm) }
    state.detail?.let { PurchaseDetail(it, state.saving, vm::close, vm::askPost,navigate) }
    state.posting?.let {
        AlertDialog(
            onDismissRequest = vm::cancelPost,
            title = { Text(if(state.detail?.str("type")=="PURCHASE_ORDER")"Confirm purchase order?"else"Post purchase document?") },
            text = { Text(if(state.detail?.str("type")=="PURCHASE_ORDER")"Confirm this order without posting a journal or stock receipt. Posted bills fulfil its quantities."else"The server will validate the financial year, period lock, tax, stock, and ledger posting.") },
            confirmButton = { Button(enabled = !state.saving, onClick = vm::post) { Text(if(state.detail?.str("type")=="PURCHASE_ORDER")"Confirm order"else"Post") } },
            dismissButton = { TextButton(enabled = !state.saving, onClick = vm::cancelPost) { Text("Cancel") } }
        )
    }
}
