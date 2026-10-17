package com.salespunch360.mobile.ui.account.sales

import com.salespunch360.mobile.ui.account.accountMoney
import com.salespunch360.mobile.ui.account.accountDate
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
import androidx.compose.material.icons.filled.Description
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
fun QuotationScreen(padding: PaddingValues, vm: QuotationViewModel = viewModel(), initialDocumentId:String?=null) {
    LaunchedEffect(initialDocumentId){initialDocumentId?.let(vm::open)}
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
        Text("Estimate Details",style=MaterialTheme.typography.headlineSmall)
        Row {
            OutlinedTextField(state.query, vm::search, label = { Text("Search estimates") }, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            if(state.canCreate)FilledIconButton(onClick = vm::createEstimate,enabled=!state.saving) { Icon(Icons.Default.Add, "Add Estimate") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            item { FilterChip(state.status == null, { vm.filter(null) }, { Text("All") }) }
            items(listOf("OPEN", "CLOSED")) { status ->
                FilterChip(state.status == status, { vm.filter(status) }, { Text(status.lowercase().replaceFirstChar{it.uppercase()}) })
            }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.message?.let { Text(it) }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error);TextButton(vm::retry,enabled=!state.saving){Text("Retry loading")} }
        LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            if(!state.loading&&state.error==null&&state.rows.isEmpty())item{Column(Modifier.fillMaxWidth().padding(vertical=40.dp),horizontalAlignment=androidx.compose.ui.Alignment.CenterHorizontally){Icon(Icons.Default.Description,null,Modifier.size(96.dp),tint=MaterialTheme.colorScheme.primary);Text(if(state.query.isNotBlank()||state.status!=null)"No matching estimates"else "No estimates yet",style=MaterialTheme.typography.titleLarge);Text(if(state.query.isNotBlank()||state.status!=null)"Try another party name, number or status."else "Create an estimate for your next sale.");if(state.canCreate)Button(vm::createEstimate,enabled=!state.saving){Text("Add Estimate")}}}
            items(state.rows, key = { it.id }) { quotation ->
                ElevatedCard(onClick={vm.open(quotation.id)},modifier=Modifier.fillMaxWidth()){
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(quotation.customer.ifBlank{"Customer not provided"},fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));Text(accountMoney(quotation.total),fontWeight=FontWeight.Bold)}
                        Text("${quotation.type} · ${quotation.number} · R${quotation.revision}")
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(quotation.status.replace('_',' '));Text(accountDate(quotation.issueDate))}
                    }
                }
            }
        }
    }

    state.draft?.let { QuotationEditor(it, state, vm) }
    state.detail?.let { QuotationDetail(it, vm, state.preview) }
}

@Composable
private fun QuotationEditor(draft: QuotationDraft, state: QuotationState, vm: QuotationViewModel) {
    AlertDialog(
        onDismissRequest = vm::closeDraft,
        title = { Text(when { draft.id == null -> "New quotation"; draft.revision -> "New revision"; else -> "Edit quotation" }) },
        confirmButton = { Column { if(draft.id==null) TextButton(enabled=!state.saving && draft.customerId.isNotBlank() && invoiceCustomFieldsValid(state.customFields,"QUOTATION",draft.customFields),onClick=vm::saveAndNew) { Text("Save & New") }; Button(enabled = !state.saving && invoiceCustomFieldsValid(state.customFields,"QUOTATION",draft.customFields) && draft.customerId.isNotBlank() && draft.lines.isNotEmpty(), onClick = vm::save) { Text(if(state.saving) "Saving…" else "Save") } } },
        dismissButton = { TextButton(enabled=!state.saving,onClick = vm::closeDraft) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                state.error?.let { error -> item { Text(error,color=MaterialTheme.colorScheme.error) } }
                if(draft.id==null) {
                item { SelectField("Type", draft.documentType, listOf("QUOTATION" to "Quotation", "ESTIMATE" to "Estimate", "BOQ" to "BOQ")) { vm.editDraft(draft.copy(documentType = it)) } }
                item { SelectField("Branch", draft.branchId, state.branches.map { it.id to it.name }) { vm.editDraft(draft.copy(branchId = it, customerId = "")) } }
                item { SelectField("Customer", draft.customerId, state.customers.filter { it.branchId==draft.branchId }.map { it.id to it.name }) { vm.editDraft(draft.copy(customerId = it)) } }
                } else {
                    item { Text("Type: ${draft.documentType}") }
                    item { Text("Branch: ${state.branches.firstOrNull{it.id==draft.branchId}?.name?:draft.branchId}") }
                    item { Text("Customer: ${state.customers.firstOrNull{it.id==draft.customerId}?.name?:state.detail?.array("revisions")?.firstOrNull()?.str("customerName").orEmpty()}") }
                }
                item { OutlinedTextField(draft.issueDate, { vm.editDraft(draft.copy(issueDate = it)) }, label = { Text("Issue date") }) }
                item { OutlinedTextField(draft.validUntil, { vm.editDraft(draft.copy(validUntil = it)) }, label = { Text("Valid until") }) }
                itemsIndexed(draft.lines) { index, line -> QuotationLine(index, line, state, vm) }
                item { OutlinedButton(onClick = vm::addLine) { Text("Add line") } }
                item { OutlinedTextField(draft.terms, { vm.editDraft(draft.copy(terms = it)) }, label = { Text("Terms") }, minLines = 2) }
                item { OutlinedTextField(draft.inclusions, { vm.editDraft(draft.copy(inclusions = it)) }, label = { Text("Inclusions") }) }
                item { OutlinedTextField(draft.exclusions, { vm.editDraft(draft.copy(exclusions = it)) }, label = { Text("Exclusions") }) }
                item { InvoiceCustomFields(state.customFields,"QUOTATION",draft.customFields,state.saving){vm.editDraft(draft.copy(customFields=it))} }
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
private fun QuotationDetail(quotation: JsonObject, vm: QuotationViewModel, preview: Boolean) {
    val revision = quotation.array("revisions").firstOrNull()
    val capabilities=quotation["capabilities"] as? JsonObject
    val allowedTransitions = quotation["allowedTransitions"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty()
    AlertDialog(
        onDismissRequest = vm::close,
        title = { Text(quotation.str("documentNumber")) },
        confirmButton = {},
        dismissButton = { TextButton(onClick = vm::close) { Text(if(preview) "Close preview" else "Close") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    Text("${quotation.str("documentType")} · ${quotation.str("status")}", fontWeight = FontWeight.Bold)
                    Text(revision?.str("customerName").orEmpty())
                    Text("Grand total ${accountMoney(revision?.str("grandTotal").orEmpty())}")
                }
                revision?.array("lines")?.let { lines -> items(lines) { line -> Text("${line.str("itemName")} · ${line.str("quantity")} × ${accountMoney(line.str("rate"))} = ${accountMoney(line.str("lineTotal"))}") } }
                item {
                    if(!preview) allowedTransitions.forEach { target -> Button(onClick = { vm.transition(target) }, modifier = Modifier.fillMaxWidth()) { Text(target.replace('_', ' ')) } }
                    if (!preview && (capabilities?.get("canEdit")?.jsonPrimitive?.booleanOrNull==true || capabilities?.get("canRevise")?.jsonPrimitive?.booleanOrNull==true)) {
                        OutlinedButton(onClick = vm::revise, modifier = Modifier.fillMaxWidth()) { Text(if (quotation.str("status") == "DRAFT") "Edit" else "Create revision") }
                    }
                    if (!preview && capabilities?.get("canShare")?.jsonPrimitive?.booleanOrNull==true) OutlinedButton(onClick = vm::share, modifier = Modifier.fillMaxWidth()) { Text("Share link") }
                    OutlinedButton(onClick = vm::download, modifier = Modifier.fillMaxWidth()) { Text("Download / share PDF") }
                }
            }
        }
    )
}
