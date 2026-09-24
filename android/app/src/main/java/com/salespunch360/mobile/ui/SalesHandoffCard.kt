package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.SalesHandoffViewModel
import com.salespunch360.mobile.data.telecallingResultLabel

@Composable
fun SalesHandoffCard(vm: SalesHandoffViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val open = state.actions.filter { it.status != "ACTION_TAKEN" }
    if (state.loading || (open.isEmpty() && state.message == null)) return
    ContentCard("Telecaller Handoffs", if (open.isEmpty()) "No pending telecaller handoffs." else "Leads that need Sales attention after a telecaller call.") {
        state.message?.let { MessageBanner(it, vm::clearMessage) }
        open.take(4).forEach { action ->
            HorizontalDivider(color = SalesLine)
            Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(action.leadTitle, fontWeight = FontWeight.Bold, color = SalesInk)
                Text("${telecallingResultLabel(action.trigger)} · from ${action.callerName}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
                action.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (action.status == "PENDING") {
                        OutlinedButton(
                            onClick = { vm.update(action.id, "ACKNOWLEDGED") },
                            enabled = state.busyId == null,
                            modifier = Modifier.weight(1f),
                        ) { Text("Acknowledge") }
                    }
                    Button(
                        onClick = { vm.update(action.id, "ACTION_TAKEN") },
                        enabled = state.busyId == null,
                        modifier = Modifier.weight(1f),
                    ) { Text("Action Taken") }
                }
            }
        }
        if (open.size > 4) Text("${open.size - 4} more pending handoffs", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
    }
}
