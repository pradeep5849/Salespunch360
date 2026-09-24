package com.salespunch360.mobile.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.TelecallingViewModel
import com.salespunch360.mobile.data.CallbackQueueItem
import com.salespunch360.mobile.data.LeadCallHistoryItem
import com.salespunch360.mobile.data.TELECALLING_RESULT_OPTIONS
import com.salespunch360.mobile.data.TelecallingLead
import com.salespunch360.mobile.data.telecallingResultLabel
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun TelecallingScreen(vm: TelecallingViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    var callbacksOnly by remember { mutableStateOf(false) }
    var pendingCall by remember { mutableStateOf<TelecallingLead?>(null) }

    fun dial(lead: TelecallingLead) {
        val phone = lead.phone?.trim().orEmpty()
        if (phone.isBlank()) return
        pendingCall = lead
        runCatching {
            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", phone, null)))
        }
    }

    state.historyLead?.let { lead ->
        TelecallingHistoryScreen(
            lead = lead,
            history = state.history,
            busy = state.busy,
            message = state.message,
            clearMessage = vm::clearMessage,
            back = vm::closeHistory,
            call = { dial(lead) },
        )
        pendingCall?.let { target ->
            CallResultDialog(target.title, state.busy, { pendingCall = null }) { result, notes, callbackAt ->
                pendingCall = null
                vm.recordCall(target, result, notes, callbackAt)
            }
        }
        return
    }

    if (state.loading && state.queue.isEmpty()) {
        LoadingScreen("Loading telecalling queue…")
        return
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text("Telecalling", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = SalesInk)
            Text("Call leads across the Sales team and save the result after each call.", color = SalesMuted)
            HorizontalDivider(Modifier.padding(top = 8.dp, bottom = 8.dp), color = SalesLine)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = vm::setQuery,
                    label = { Text("Search lead or phone") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                Button(onClick = { vm.refresh() }, modifier = Modifier.padding(top = 8.dp)) { Text("Search") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                FilterChip(selected = !callbacksOnly, onClick = { callbacksOnly = false }, label = { Text("All Leads ${state.queue.size}") })
                FilterChip(selected = callbacksOnly, onClick = { callbacksOnly = true }, label = { Text("Callbacks ${state.callbacks.size}") })
            }
            state.message?.let { MessageBanner(it, vm::clearMessage) }
        }

        if (callbacksOnly) {
            if (state.callbacks.isEmpty()) item { ContentCard("Callbacks", "No pending callbacks.") }
            items(state.callbacks, key = { "callback-${it.id}" }) { callback ->
                CallbackCard(
                    callback,
                    onCall = {
                        val lead = state.queue.firstOrNull { it.id == callback.leadId }
                            ?: TelecallingLead(callback.leadId, callback.leadTitle, phone = callback.phone, stage = "CALL_BACK", assignedUserId = "", ownerName = callback.ownerName)
                        dial(lead)
                    },
                    onHistory = {
                        val lead = state.queue.firstOrNull { it.id == callback.leadId }
                            ?: TelecallingLead(callback.leadId, callback.leadTitle, phone = callback.phone, stage = "CALL_BACK", assignedUserId = "", ownerName = callback.ownerName)
                        vm.openHistory(lead)
                    },
                )
            }
        } else {
            if (state.queue.isEmpty()) item { ContentCard("No Leads", "No leads match this search.") }
            items(state.queue, key = { it.id }) { lead ->
                TelecallingLeadCard(lead, state.busy, { dial(lead) }, { vm.openHistory(lead) })
            }
        }
    }

    pendingCall?.let { lead ->
        CallResultDialog(lead.title, state.busy, { pendingCall = null }) { result, notes, callbackAt ->
            pendingCall = null
            vm.recordCall(lead, result, notes, callbackAt)
        }
    }
}

@Composable
private fun TelecallingLeadCard(lead: TelecallingLead, busy: Boolean, onCall: () -> Unit, onHistory: () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(lead.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                StatusChip(lead.stage.replace('_', ' '))
            }
            lead.contactName?.let { Text(it, color = SalesMuted) }
            Text("Owner: ${lead.ownerName}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
            Text("Calls ${lead.calls}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            lead.phone?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SalesMuted) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onCall, enabled = !busy && !lead.phone.isNullOrBlank(), modifier = Modifier.weight(1f)) { Text("Call") }
                OutlinedButton(onClick = onHistory, enabled = !busy, modifier = Modifier.weight(1f)) { Text("History") }
            }
        }
    }
}

@Composable
private fun CallbackCard(callback: CallbackQueueItem, onCall: () -> Unit, onHistory: () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(callback.leadTitle, fontWeight = FontWeight.Bold)
            Text("Owner: ${callback.ownerName}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
            Text("Callback: ${friendlyCallTime(callback.nextCallbackAt)}", style = MaterialTheme.typography.bodySmall)
            callback.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SalesMuted) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onCall, enabled = !callback.phone.isNullOrBlank(), modifier = Modifier.weight(1f)) { Text("Call") }
                OutlinedButton(onClick = onHistory, modifier = Modifier.weight(1f)) { Text("History") }
            }
        }
    }
}

@Composable
private fun TelecallingHistoryScreen(
    lead: TelecallingLead,
    history: List<LeadCallHistoryItem>,
    busy: Boolean,
    message: String?,
    clearMessage: () -> Unit,
    back: () -> Unit,
    call: () -> Unit,
) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            TextButton(back, contentPadding = PaddingValues(0.dp)) { Text("← Back") }
            Text("Call History", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = SalesInk)
            Text(lead.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Owner: ${lead.ownerName} · Calls ${lead.calls}", color = SalesMuted)
            lead.phone?.let { Text(it, color = SalesMuted) }
            Button(call, enabled = !busy && !lead.phone.isNullOrBlank(), modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) { Text("Call") }
            message?.let { MessageBanner(it, clearMessage) }
        }
        if (history.isEmpty()) item { ContentCard("History", "No saved call results for this lead.") }
        items(history, key = { it.id }) { item -> CallHistoryCard(item) }
    }
}

@Composable
internal fun CallHistoryCard(item: LeadCallHistoryItem) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(telecallingResultLabel(item.result), fontWeight = FontWeight.Bold)
            Text("${item.callerName} · ${friendlyCallTime(item.calledAt)}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
            item.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            item.nextCallbackAt?.let { Text("Next callback: ${friendlyCallTime(it)}", style = MaterialTheme.typography.bodySmall, color = SalesMuted) }
        }
    }
}

@Composable
internal fun CallResultDialog(
    leadTitle: String,
    busy: Boolean,
    dismiss: () -> Unit,
    save: (result: String, notes: String?, nextCallbackAt: String?) -> Unit,
) {
    var result by remember { mutableStateOf("CONNECTED") }
    var resultMenu by remember { mutableStateOf(false) }
    var notes by remember { mutableStateOf("") }
    var callbackText by remember {
        mutableStateOf(LocalDateTime.now(ZoneId.of("Asia/Kolkata")).plusDays(1).withSecond(0).withNano(0).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))
    }
    val callbackIso = if (result == "CALL_BACK") callbackIso(callbackText) else null
    AlertDialog(
        onDismissRequest = dismiss,
        title = { Text("Save call result") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(leadTitle, fontWeight = FontWeight.Bold)
                Text("The call is counted only after you save a result.", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
                Box {
                    OutlinedButton(onClick = { resultMenu = true }, modifier = Modifier.fillMaxWidth()) { Text(telecallingResultLabel(result)) }
                    DropdownMenu(expanded = resultMenu, onDismissRequest = { resultMenu = false }) {
                        TELECALLING_RESULT_OPTIONS.forEach { (value, label) ->
                            DropdownMenuItem(text = { Text(label) }, onClick = { result = value; resultMenu = false })
                        }
                    }
                }
                OutlinedTextField(value = notes, onValueChange = { notes = it.take(2000) }, label = { Text("Notes") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                if (result == "CALL_BACK") {
                    OutlinedTextField(
                        value = callbackText,
                        onValueChange = { callbackText = it.take(16) },
                        label = { Text("Callback date & time") },
                        supportingText = { Text("Format: YYYY-MM-DD HH:MM") },
                        isError = callbackIso == null,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { save(result, notes.trim().ifBlank { null }, callbackIso) },
                enabled = !busy && (result != "CALL_BACK" || callbackIso != null),
            ) { Text(if (busy) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(dismiss) { Text("Cancel") } },
    )
}

private fun callbackIso(value: String): String? = runCatching {
    LocalDateTime.parse(value.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
        .atZone(ZoneId.of("Asia/Kolkata"))
        .toInstant()
        .toString()
}.getOrNull()

private fun friendlyCallTime(value: String?): String {
    if (value.isNullOrBlank()) return "—"
    return runCatching {
        java.time.Instant.parse(value).atZone(ZoneId.of("Asia/Kolkata"))
            .format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))
    }.recoverCatching {
        java.time.OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Asia/Kolkata"))
            .format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))
    }.getOrDefault(value)
}
