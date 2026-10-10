package com.salespunch360.mobile.ui.account.expense

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.ExpenseCategoryViewModel
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.ui.account.accounting.Option
import kotlinx.serialization.json.*

@Composable
fun ExpenseCategoryScreen(padding: PaddingValues, vm: ExpenseCategoryViewModel = viewModel()) {
    val s = vm.state.collectAsStateWithLifecycle().value
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
        Row {
            OutlinedTextField(s.query, vm::search, label = { Text("Search categories") }, modifier = Modifier.weight(1f))
            IconButton(vm::load) { Icon(Icons.Default.Refresh, "Refresh") }
            if (s.canManage) FilledIconButton({ vm.edit() }, enabled = !s.saving) { Icon(Icons.Default.Add, "New category") }
        }
        if (s.loading || s.saving) LinearProgressIndicator(Modifier.fillMaxWidth())
        s.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        s.message?.let { Text(it) }
        if (!s.loading && s.categories.isEmpty()) Text("No categories found.")
        LazyColumn {
            items(s.categories, key = { it.str("id") }) { x ->
                ListItem(
                    headlineContent = { Text(x.str("name")) },
                    supportingContent = { Text("${x.str("scope")} · ${s.ledgers.firstOrNull { it.str("id") == x.str("defaultLedgerAccountId") }?.str("name").orEmpty()}") },
                    trailingContent = {
                        if (x["isActive"]?.jsonPrimitive?.booleanOrNull == true) {
                            if (s.canManage) TextButton({ vm.disable(x.str("id")) }, enabled = !s.saving) { Text("Deactivate") }
                        } else Text("Inactive")
                    },
                    modifier = Modifier.clickable(enabled = s.canManage && !s.saving) { vm.edit(x) }
                )
            }
        }
    }
    s.editing?.let { CategoryEditor(it, s.ledgers, s.saving, s.error, vm::close, vm::save) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CategoryEditor(x: JsonObject, ledgers: List<JsonObject>, saving: Boolean, error: String?, close: () -> Unit, save: (JsonObject) -> Unit) {
    var name by remember(x) { mutableStateOf(x.str("name")) }
    var scope by remember(x) { mutableStateOf(x.str("scope").ifBlank { "EXPENSE" }) }
    var ledger by remember(x) { mutableStateOf(x.str("defaultLedgerAccountId")) }
    var income by remember(x) { mutableStateOf(x.str("incomeLedgerAccountId")) }
    var openScope by remember { mutableStateOf(false) }
    val defaultClass = if (scope == "INCOME") "INCOME" else "EXPENSE"
    val validLedger = ledgers.any { it.str("id") == ledger && it.str("accountClass") == defaultClass }
    val validIncome = scope != "BOTH" || ledgers.any { it.str("id") == income && it.str("accountClass") == "INCOME" }
    AlertDialog(
        onDismissRequest = { if (!saving) close() },
        title = { Text("Expense / Income category") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, enabled = !saving)
                ExposedDropdownMenuBox(openScope, { if (!saving) openScope = it }) {
                    OutlinedTextField(scope, {}, readOnly = true, label = { Text("Scope") }, modifier = Modifier.menuAnchor())
                    ExposedDropdownMenu(openScope, { openScope = false }) {
                        listOf("EXPENSE", "INCOME", "BOTH").forEach { v ->
                            DropdownMenuItem({ Text(v) }, { scope = v; ledger = ""; income = ""; openScope = false })
                        }
                    }
                }
                Option(if (scope == "BOTH") "Expense posting ledger" else "Posting ledger", ledger, ledgers.filter { it.str("accountClass") == defaultClass }) { ledger = it }
                if (scope == "BOTH") Option("Income posting ledger", income, ledgers.filter { it.str("accountClass") == "INCOME" }) { income = it }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            Button(enabled = !saving && name.isNotBlank() && validLedger && validIncome, onClick = {
                save(buildJsonObject { put("name", name); put("scope", scope); put("defaultLedgerAccountId", ledger); if (scope == "BOTH") put("incomeLedgerAccountId", income) })
            }) { Text(if (saving) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(close, enabled = !saving) { Text("Cancel") } }
    )
}
