package com.salespunch360.mobile.ui.account.sales

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.QuotationDraft
import com.salespunch360.mobile.QuotationState
import com.salespunch360.mobile.QuotationViewModel
import com.salespunch360.mobile.account.SalesLineDraft
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import java.io.File
import kotlinx.serialization.json.*

@Composable
fun QuotationScreen(padding: PaddingValues, vm: QuotationViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    LaunchedEffect(state.pdf) {
        state.pdf?.let { bytes ->
            val file = File(context.cacheDir, "quotation.pdf")
            file.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
            val send = Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(send, "Share quotation"))
            vm.consumedPdf()
        }
    }
    state.shareToken?.let { token ->
        LaunchedEffect(token) {
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "https://www.salespunch360.com/share/quotation/$token")
            context.startActivity(Intent.createChooser(send, "Share quotation link"))
        }
    }
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        Row {
            OutlinedTextField(state.query, vm::search, label = { Text("Search quotations") }, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            FilledIconButton(onClick = vm::create) { Icon(Icons.Default.Add, "New quotation") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            item { FilterChip(state.status == null, { vm.filter(null) }, { Text("All") }) }
            items(listOf("DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED", "REJECTED", "DECLINED", "EXPIRED", "CANCELLED")) { status ->
                FilterChip(state.status == status, { vm.filter(status) }, { Text(status.replace('_', ' ')) })
            }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        LazyColumn {
            items(state.rows, key = { it.id }) { quotation ->
                ListItem(
                    headlineContent = { Text(quotation.number, fontWeight = FontWeight.Bold) },
                    supportingContent = { Text("${quotation.customer} · ${quotation.type} · R${quotation.revision}") },
                    trailingContent = { Column { Text("₹${quotation.total}"); Text(quotation.status) } },
                    modifier = Modifier.clickable { vm.open(quotation.id) }
                )
            }
        }
    }
    state.draft?.let { QuotationEditor(it, state, vm) }
    state.detail?.let { QuotationDetail(it, vm) }
}

@Composable
private fun QuotationEditor(draft: QuotationDraft, state: QuotationState, vm: QuotationViewModel) {
    AlertDialog(
        onDismissRequest = vm::closeDraft,
        title = { Text(when { draft.id == null -> "New quotation"; draft.revision -> "New revision"; else -> "Edit quotation" }) },
        confirmButton = { Button(enabled = !state.saving && draft.customerId.isNotBlank() && draft.lines.isNotEmpty(), onClick = vm::save) { Text("Save") } },
        dismissButton = { TextButton(onClick = vm::closeDraft) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { SelectField("Type", draft.documentType, listOf("QUOTATION" to "Quotation", "ESTIMATE" to "Estimate", "BOQ" to "BOQ")) { vm.editDraft(draft.copy(documentType = it)) } }
                item { SelectField("Branch", draft.branchId, state.branches.map { it.id to it.name }) { vm.editDraft(draft.copy(branchId = it, customerId = "")) } }
                item { SelectField("Customer", draft.customerId, state.customers.map { it.id to it.name }) { vm.editDraft(draft.copy(customerId = it)) } }
                item { OutlinedTextField(draft.issueDate, { vm.editDraft(draft.copy(issueDate = it)) }, label = { Text("Issue date") }) }
                item { OutlinedTextField(draft.validUntil, { vm.editDraft(draft.copy(validUntil = it)) }, label = { Text("Valid until") }) }
                itemsIndexed(draft.lines) { index, line -> QuotationLine(index, line, state, vm) }
                item { OutlinedButton(onClick = vm::addLine) { Text("Add line") } }
                item { OutlinedTextField(draft.terms, { vm.editDraft(draft.copy(terms = it)) }, label = { Text("Terms") }, minLines = 2) }
                item { OutlinedTextField(draft.inclusions, { vm.editDraft(draft.copy(inclusions = it)) }, label = { Text("Inclusions") }) }
                item { OutlinedTextField(draft.exclusions, { vm.editDraft(draft.copy(exclusions = it)) }, label = { Text("Exclusions") }) }
                item { OutlinedTextField(draft.notes, { vm.editDraft(draft.copy(notes = it)) }, label = { Text("Notes") }) }
                item { Text("All totals and lifecycle validation are calculated by the server.", style = MaterialTheme.typography.bodySmall) }
            }
        }
    )
}

@Composable
private fun QuotationLine(index: Int, line: SalesLineDraft, state: QuotationState, vm: QuotationViewModel) {
    val masters = when (line.lineType) { "PRODUCT" -> state.products; "SERVICE" -> state.services; "WORK_PACKAGE" -> state.workPackages; else -> emptyList() }
    ElevatedCard {
        Column(Modifier.padding(10.dp)) {
            SelectField("Line type", line.lineType, listOf("PRODUCT" to "Product", "SERVICE" to "Service", "WORK_PACKAGE" to "Work package", "CUSTOM" to "Custom")) { vm.line(index, line.copy(lineType = it, sourceId = "")) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { vm.line(index, line.copy(itemName = it)) }, label = { Text("Name") })
            } else {
                SelectField("Item", line.sourceId, masters.map { it.id to it.name }) { id -> val master = masters.first { it.id == id }; vm.line(index, line.copy(sourceId = id, rate = master.rate.orEmpty(), taxRate = master.taxRate.orEmpty())) }
            }
            Row {
                OutlinedTextField(line.quantity, { vm.line(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { vm.line(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(line.taxRate, { vm.line(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            if ((state.draft?.lines?.size ?: 0) > 1) TextButton(onClick = { vm.removeLine(index) }) { Text("Remove") }
        }
    }
}

@Composable
private fun QuotationDetail(quotation: JsonObject, vm: QuotationViewModel) {
    val revision = quotation.array("revisions").firstOrNull()
    val allowedTransitions = quotation["allowedTransitions"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty()
    AlertDialog(
        onDismissRequest = vm::close,
        title = { Text(quotation.str("documentNumber")) },
        confirmButton = {},
        dismissButton = { TextButton(onClick = vm::close) { Text("Close") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    Text("${quotation.str("documentType")} · ${quotation.str("status")}", fontWeight = FontWeight.Bold)
                    Text(revision?.str("customerName").orEmpty())
                    Text("Grand total ₹${revision?.str("grandTotal").orEmpty()}")
                }
                revision?.array("lines")?.let { lines -> items(lines) { line -> Text("${line.str("itemName")} · ${line.str("quantity")} × ₹${line.str("rate")} = ₹${line.str("lineTotal")}") } }
                item {
                    allowedTransitions.forEach { target -> Button(onClick = { vm.transition(target) }, modifier = Modifier.fillMaxWidth()) { Text(target.replace('_', ' ')) } }
                    if (quotation.str("status") in listOf("DRAFT", "APPROVED", "REJECTED", "SENT", "DECLINED", "EXPIRED")) {
                        OutlinedButton(onClick = vm::revise, modifier = Modifier.fillMaxWidth()) { Text(if (quotation.str("status") == "DRAFT") "Edit" else "Create revision") }
                    }
                    if (quotation.str("status") in listOf("APPROVED", "SENT")) OutlinedButton(onClick = vm::share, modifier = Modifier.fillMaxWidth()) { Text("Share link") }
                    OutlinedButton(onClick = vm::download, modifier = Modifier.fillMaxWidth()) { Text("Download / share PDF") }
                }
            }
        }
    )
}
