package com.salespunch360.mobile.ui.account.accounting

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
import com.salespunch360.mobile.AccountAccountingViewModel
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.*

@Composable
fun FinancialYearScreen(
    periodLocks: Boolean,
    padding: PaddingValues,
    vm: AccountAccountingViewModel = viewModel()
) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val years = state.data.array("financialYears").map { it.jsonObject }

    Column(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(16.dp)
    ) {
        Row {
            Text(
                if (periodLocks) "Period locks" else "Financial years",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = { vm.load() }) {
                Icon(Icons.Default.Refresh, "Refresh")
            }
            FilledIconButton(
                onClick = { vm.editor(if (periodLocks) "period-locks" else "financial-years") }
            ) {
                Icon(Icons.Default.Add, "New")
            }
        }

        if (state.loading) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        LazyColumn {
            items(years, key = { it.str("id") }) { year ->
                val lock = state.data.array("accountingPeriodLocks")
                    .map { it.jsonObject }
                    .firstOrNull { it.str("financialYearId") == year.str("id") }

                ListItem(
                    headlineContent = { Text(year.str("name")) },
                    supportingContent = {
                        Text(
                            "${year.str("startDate").take(10)} – ${year.str("endDate").take(10)}" +
                                lock?.let { " · locked through ${it.str("lockedThrough").take(10)}" }.orEmpty()
                        )
                    },
                    trailingContent = {
                        if (!periodLocks && year.str("status") == "OPEN") {
                            TextButton(onClick = { vm.editor("close:${year.str("id")}") }) {
                                Text("Close")
                            }
                        } else {
                            Text(year.str("status"))
                        }
                    }
                )
            }
        }
    }

    state.editor?.let { kind ->
        FinancialDialog(
            kind = kind,
            years = years,
            close = vm::close,
            save = { target, payload -> vm.save(target, payload) }
        )
    }
}

@Composable
private fun FinancialDialog(
    kind: String,
    years: List<JsonObject>,
    close: () -> Unit,
    save: (String, JsonObject) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var year by remember { mutableStateOf(kind.substringAfter("close:", "")) }
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = close,
        title = { Text(kind.substringBefore(':').replace('-', ' ')) },
        text = {
            Column {
                when (kind) {
                    "financial-years" -> {
                        OutlinedTextField(name, { name = it }, label = { Text("Name") })
                        OutlinedTextField(from, { from = it }, label = { Text("Start date") })
                        OutlinedTextField(to, { to = it }, label = { Text("End date") })
                    }
                    "period-locks" -> {
                        Option("Financial year", year, years) { year = it }
                        OutlinedTextField(to, { to = it }, label = { Text("Lock through") })
                        OutlinedTextField(reason, { reason = it }, label = { Text("Reason") })
                    }
                    else -> {
                        Text("Closing performs server verification and permanently locks the year.")
                        OutlinedTextField(
                            reason,
                            { reason = it },
                            label = { Text("Early-close reason when required") }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    when (kind) {
                        "financial-years" -> save(
                            "financial-years",
                            buildJsonObject {
                                put("name", name)
                                put("startDate", from)
                                put("endDate", to)
                                put("isCurrent", true)
                            }
                        )
                        "period-locks" -> save(
                            "period-locks",
                            buildJsonObject {
                                put("financialYearId", year)
                                put("lockedThrough", to)
                                put("reason", reason)
                            }
                        )
                        else -> save(
                            "close-year",
                            buildJsonObject {
                                put("financialYearId", year)
                                put("earlyCloseReason", reason)
                            }
                        )
                    }
                }
            ) {
                Text("Confirm on server")
            }
        },
        dismissButton = {
            TextButton(onClick = close) { Text("Cancel") }
        }
    )
}
