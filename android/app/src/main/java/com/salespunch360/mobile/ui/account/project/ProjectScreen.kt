package com.salespunch360.mobile.ui.account.project

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.*
import com.salespunch360.mobile.account.*
import kotlinx.serialization.json.*

private fun workflowStatus(status: String) = when (status) {
    "ON_HOLD" -> "ON_HOLD"
    "COMPLETED", "CLOSED", "CANCELLED" -> "COMPLETED"
    else -> "ACTIVE"
}

private fun workflowStatusLabel(status: String) = when (workflowStatus(status)) {
    "ON_HOLD" -> "Hold"
    "COMPLETED" -> "Completed"
    else -> "Active"
}

@Composable
fun ProjectScreen(
    padding: PaddingValues,
    vm: AccountProjectViewModel = viewModel(),
) {
    val s = vm.state.collectAsStateWithLifecycle().value
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
        Row {
            OutlinedTextField(
                s.query,
                vm::search,
                label = { Text("Search projects") },
                modifier = Modifier.weight(1f),
            )
            IconButton(vm::load) { Icon(Icons.Default.Refresh, "Refresh") }
            FilledIconButton(vm::create) { Icon(Icons.Default.Add, "New project") }
        }
        LazyRow {
            items(listOf<String?>(null, "ACTIVE", "ON_HOLD", "COMPLETED")) { value ->
                FilterChip(
                    s.status == value,
                    { vm.filter(value) },
                    {
                        Text(
                            when (value) {
                                "ACTIVE" -> "Active"
                                "ON_HOLD" -> "Hold"
                                "COMPLETED" -> "Completed"
                                else -> "All"
                            },
                        )
                    },
                )
            }
        }
        if (s.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        s.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        LazyColumn {
            items(s.rows, key = { it.str("id") }) { row ->
                ListItem(
                    headlineContent = {
                        Text(
                            "${row.str("projectNumber")} · ${row.str("name")}",
                            fontWeight = FontWeight.Bold,
                        )
                    },
                    supportingContent = {
                        Text(
                            "${row["customer"]?.jsonObject?.str("name")} · ${row["branch"]?.jsonObject?.str("name")}",
                        )
                    },
                    trailingContent = { Text(workflowStatusLabel(row.str("status"))) },
                    modifier = Modifier.clickable { vm.open(row.str("id")) },
                )
            }
        }
    }
    s.editing?.let { ProjectEditor(it, s.options, vm::close, vm::save) }
    s.detail?.let {
        ProjectDetail(
            it,
            s.costing,
            vm::close,
            vm::edit,
            vm::action,
            vm::editBudget,
        )
    }
    if (s.budgetEditing && s.detail != null) {
        BudgetDialog(s.detail!!, { vm.editBudget(false) }, vm::saveBudget)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectEditor(
    x: JsonObject,
    options: JsonObject,
    close: () -> Unit,
    save: (JsonObject) -> Unit,
) {
    val edit = x.containsKey("id")
    var name by remember { mutableStateOf(x.str("name")) }
    var branch by remember { mutableStateOf(x.str("branchId")) }
    var manager by remember { mutableStateOf(x.str("projectManagerId")) }
    var value by remember { mutableStateOf(x.str("projectValue").ifBlank { "0" }) }
    var siteName by remember { mutableStateOf(x.str("siteName")) }
    var siteAddress by remember { mutableStateOf(x.str("siteAddress")) }
    var siteContactName by remember { mutableStateOf(x.str("siteContactName")) }
    var siteContactPhone by remember { mutableStateOf(x.str("siteContactPhone")) }
    var start by remember { mutableStateOf(x.str("startDate").take(10)) }
    var status by remember { mutableStateOf(workflowStatus(x.str("status"))) }

    AlertDialog(
        onDismissRequest = close,
        title = { Text(if (edit) "Edit project" else "New project") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { OutlinedTextField(name, { name = it }, label = { Text("Project name") }) }
                if (!edit) {
                    item { Pick("Branch", branch, options.array("branches")) { branch = it } }
                }
                item { Pick("Project manager", manager, options.array("managers")) { manager = it } }
                item { OutlinedTextField(value, { value = it }, label = { Text("Project value") }) }
                item { OutlinedTextField(siteName, { siteName = it }, label = { Text("Site name") }) }
                item { OutlinedTextField(siteAddress, { siteAddress = it }, label = { Text("Site address") }) }
                item { OutlinedTextField(siteContactName, { siteContactName = it }, label = { Text("Site contact") }) }
                item { OutlinedTextField(siteContactPhone, { siteContactPhone = it }, label = { Text("Mobile number") }) }
                item { OutlinedTextField(start, { start = it }, label = { Text("Start date") }) }
                if (edit) {
                    item {
                        PickText(
                            "Status",
                            status,
                            listOf("ACTIVE", "ON_HOLD"),
                        ) { status = it }
                    }
                } else {
                    item { Text("Status: Active") }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = name.isNotBlank() && (edit || branch.isNotBlank()),
                onClick = {
                    save(
                        buildJsonObject {
                            if (edit) {
                                put("projectId", x.str("id"))
                                put("status", status)
                            } else {
                                put("branchId", branch)
                            }
                            put("name", name)
                            manager.takeIf { it.isNotBlank() }?.let { put("projectManagerId", it) }
                            siteName.takeIf { it.isNotBlank() }?.let { put("siteName", it) }
                            siteAddress.takeIf { it.isNotBlank() }?.let { put("siteAddress", it) }
                            siteContactName.takeIf { it.isNotBlank() }?.let { put("siteContactName", it) }
                            siteContactPhone.takeIf { it.isNotBlank() }?.let { put("siteContactPhone", it) }
                            start.takeIf { it.isNotBlank() }?.let { put("startDate", it) }
                            put("projectValue", value)
                        },
                    )
                },
            ) { Text("Save") }
        },
        dismissButton = { TextButton(close) { Text("Cancel") } },
    )
}

@Composable
private fun ProjectDetail(
    x: JsonObject,
    costing: JsonObject?,
    close: () -> Unit,
    edit: () -> Unit,
    action: (String, String) -> Unit,
    budget: () -> Unit,
) {
    val final = workflowStatus(x.str("status")) == "COMPLETED"
    AlertDialog(
        onDismissRequest = close,
        title = { Text(x.str("projectNumber")) },
        text = {
            LazyColumn {
                item { Text(x.str("name"), style = MaterialTheme.typography.titleLarge) }
                item {
                    Text(
                        "${x["customer"]?.jsonObject?.str("name")} · ${x["branch"]?.jsonObject?.str("name")}",
                    )
                }
                item { Text("Status ${workflowStatusLabel(x.str("status"))} · Value ₹${x.str("projectValue")}") }
                x.str("siteAddress").takeIf { it.isNotBlank() }?.let { address ->
                    item { Text("Site: $address") }
                }
                x.str("siteContactPhone").takeIf { it.isNotBlank() }?.let { phone ->
                    item { Text("Mobile: $phone") }
                }
                if (final) {
                    item {
                        Text(
                            "Completed project · report only",
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                item {
                    Text(
                        "Customer received ₹${x.str("customerPayments")} · Vendor paid ₹${x.str("vendorPayments")}",
                    )
                }
                item { Text("Open tasks ${x.str("openTasks")}") }
                x.str("sourceQuotationId").takeIf { it.isNotBlank() }?.let { quotation ->
                    item { Text("Created from accepted quotation · $quotation") }
                }
                costing?.get("metrics")?.jsonObject?.let { metrics ->
                    item { Text("Project report / costing", style = MaterialTheme.typography.titleMedium) }
                    listOf(
                        "estimatedCost",
                        "actualCost",
                        "committedCost",
                        "revenue",
                        "profit",
                        "actualMarginPercent",
                    ).forEach { key ->
                        item {
                            ListItem(
                                headlineContent = {
                                    Text(key.replace(Regex("([A-Z])"), " $1"))
                                },
                                trailingContent = { Text(metrics.str(key)) },
                            )
                        }
                    }
                }
                costing?.array("packages")?.let { packages ->
                    item { Text("Package profitability", style = MaterialTheme.typography.titleMedium) }
                    items(packages) { element ->
                        val row = element.jsonObject
                        ListItem(
                            headlineContent = { Text(row.str("name")) },
                            supportingContent = {
                                Text("Revenue ${row.str("actualRevenue")} · Cost ${row.str("actualCost")}")
                            },
                            trailingContent = { Text("Profit ${row.str("profit")}") },
                        )
                    }
                }
                item { Text("Related documents", style = MaterialTheme.typography.titleMedium) }
                items(x.array("commercialDocuments")) { document ->
                    val row = document.jsonObject
                    Text("${row.str("documentNumber")} · ${row.str("type")} · ${row.str("status")}")
                }
            }
        },
        confirmButton = {
            if (!final) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Button(edit) { Text("Edit") }
                    OutlinedButton(budget) { Text("Budget") }
                    FilledTonalButton({ action(x.str("id"), "COMPLETE") }) {
                        Text("Complete")
                    }
                }
            }
        },
        dismissButton = { TextButton(close) { Text("Close") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Pick(
    label: String,
    value: String,
    values: List<JsonElement>,
    set: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val selected = values.map { it.jsonObject }.firstOrNull { it.str("id") == value }
    ExposedDropdownMenuBox(open, { open = it }) {
        OutlinedTextField(
            selected?.str("name").orEmpty(),
            {},
            readOnly = true,
            label = { Text(label) },
            modifier = Modifier.menuAnchor(),
        )
        ExposedDropdownMenu(open, { open = false }) {
            values.forEach { element ->
                val row = element.jsonObject
                DropdownMenuItem(
                    { Text(row.str("name")) },
                    {
                        set(row.str("id"))
                        open = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickText(
    label: String,
    value: String,
    values: List<String>,
    set: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val visible = when (value) {
        "ON_HOLD" -> "Hold"
        else -> "Active"
    }
    ExposedDropdownMenuBox(open, { open = it }) {
        OutlinedTextField(
            visible,
            {},
            readOnly = true,
            label = { Text(label) },
            modifier = Modifier.menuAnchor(),
        )
        ExposedDropdownMenu(open, { open = false }) {
            values.forEach { option ->
                DropdownMenuItem(
                    { Text(if (option == "ON_HOLD") "Hold" else "Active") },
                    {
                        set(option)
                        open = false
                    },
                )
            }
        }
    }
}

@Composable
private fun BudgetDialog(
    project: JsonObject,
    close: () -> Unit,
    save: (String, String) -> Unit,
) {
    var amount by remember { mutableStateOf(project.str("budgetTotal")) }
    AlertDialog(
        onDismissRequest = close,
        title = { Text("Project budget") },
        text = {
            OutlinedTextField(
                amount,
                { amount = it },
                label = { Text("Budget amount") },
            )
        },
        confirmButton = {
            Button(
                enabled = amount.isNotBlank(),
                onClick = { save(project.str("id"), amount) },
            ) { Text("Save authoritative budget") }
        },
        dismissButton = { TextButton(close) { Text("Cancel") } },
    )
}
