package com.salespunch360.mobile.ui.account.accounting

import com.salespunch360.mobile.ui.account.accountDate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
    vm: AccountAccountingViewModel = viewModel(),
    onRestartNumbering:(()->Unit)?=null
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

        if(!periodLocks&&state.data["capabilities"]?.jsonObject?.get("canRestartNumbering")?.jsonPrimitive?.booleanOrNull==true&&onRestartNumbering!=null)TextButton(onClick=onRestartNumbering){Text("Restart future numbering; keep history")}

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
                            "${accountDate(year.str("startDate"))} – ${accountDate(year.str("endDate"))}" +
                                lock?.let { " · locked through ${accountDate(it.str("lockedThrough"))}" }.orEmpty()
                        )
                    },
                    trailingContent = {
                        if (!periodLocks && year.str("status") == "OPEN" && state.data["capabilities"]?.jsonObject?.get("canRestartNumbering")?.jsonPrimitive?.booleanOrNull==true) {
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
            review = state.closeReview,
            busy = state.saving || state.loading,
            years = years,
            close = vm::close,
            save = { target, payload -> vm.save(target, payload) }
        )
    }
}

@Composable
private fun FinancialDialog(
    kind: String,
    review: JsonObject?,
    busy: Boolean,
    years: List<JsonObject>,
    close: () -> Unit,
    save: (String, JsonObject) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var year by remember { mutableStateOf(kind.substringAfter("close:", "")) }
    var reason by remember { mutableStateOf("") }
    var confirmed by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = close,
        title = { Text(kind.substringBefore(':').replace('-', ' ')) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
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
                        Text("Closing keeps documents and history, and locks posting through the year end. Verification runs again on confirmation.")
                        if(review==null)Text("Load the server review before confirming.")
                        review?.let { data ->
                            Text("${data.str("companyName")} · ${data.str("startDate")} – ${data.str("endDate")}")
                            Text(data.str("checkScope"))
                            data.array("checks").forEach { value ->
                                val check=value.jsonObject
                                Text("${check.str("status")}: ${check.str("check")} (${check["affected"]?.jsonPrimitive?.content.orEmpty()})")
                            }
                        }
                        OutlinedTextField(
                            reason,
                            { reason = it },
                            label = { Text("Early-close reason when required") }
                        )
                        Row { Checkbox(confirmed,{confirmed=it});Text("I confirm this year is ready to close.") }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !busy && (!kind.startsWith("close:") || (review?.get("canClose")?.jsonPrimitive?.booleanOrNull==true && confirmed && (review["earlyClose"]?.jsonPrimitive?.booleanOrNull!=true || reason.isNotBlank()))),
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
