package com.salespunch360.mobile.ui.account.purchase

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.AccountPurchaseViewModel
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.ui.account.sales.SelectField
import kotlinx.serialization.json.JsonObject

@Composable
fun PurchaseEditor(draft: PurchaseDraft, state: PurchaseState, vm: AccountPurchaseViewModel) {
    val sources = state.sources.filter {
        it.str("type") == "PURCHASE_BILL" && it.str("branchId") == draft.branchId && it.str("vendorId") == draft.vendorId
    }
    val sourceLines = sources.firstOrNull { it.str("id") == draft.sourceDocumentId }?.array("lines").orEmpty()

    AlertDialog(
        onDismissRequest = vm::closeDraft,
        title = { Text("New ${draft.type.replace('_', ' ')}") },
        confirmButton = {
            Button(enabled = !state.saving && draft.vendorId.isNotBlank() && draft.lines.isNotEmpty(), onClick = vm::save) { Text("Create draft") }
        },
        dismissButton = { TextButton(onClick = vm::closeDraft) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { SelectField("Type", draft.type, state.types.map { it to it.replace('_', ' ') }) { vm.edit(draft.copy(type = it)) } }
                item { SelectField("Branch", draft.branchId, state.branches.map { it.id to it.name }) { vm.edit(draft.copy(branchId = it, vendorId = "")) } }
                item { SelectField("Vendor", draft.vendorId, state.vendors.map { it.id to it.name }) { vm.edit(draft.copy(vendorId = it)) } }
                if (draft.type == "DEBIT_NOTE") item {
                    SelectField("Source purchase bill", draft.sourceDocumentId, sources.map { it.str("id") to it.str("documentNumber") }) { vm.edit(draft.copy(sourceDocumentId = it)) }
                }
                if (draft.type == "PURCHASE_BILL") item {
                    SelectField(
                        "Source purchase order",
                        draft.sourcePurchaseOrderId,
                        state.purchaseOrders.filter { it.str("branchId") == draft.branchId && it.str("vendorId") == draft.vendorId }.map { it.str("id") to it.str("documentNumber") }
                    ) { vm.edit(draft.copy(sourcePurchaseOrderId = it)) }
                }
                item { OutlinedTextField(draft.issueDate, { vm.edit(draft.copy(issueDate = it)) }, label = { Text("Issue date") }) }
                item { OutlinedTextField(draft.dueDate, { vm.edit(draft.copy(dueDate = it)) }, label = { Text("Due date") }) }
                item { SelectField("Purpose", draft.purpose, listOf("OFFICE" to "Office", "PROJECT" to "Project")) { vm.edit(draft.copy(purpose = it)) } }
                if (draft.purpose == "PROJECT") item { SelectField("Project", draft.projectId, state.projects.map { it.id to it.name }) { vm.edit(draft.copy(projectId = it)) } }
                item {
                    SelectField("Classification", draft.classification, listOf("PURCHASE_COST" to "Purchase cost", "GENERAL_EXPENSES" to "General expenses", "FIXED_ASSET" to "Fixed asset")) { vm.edit(draft.copy(classification = it)) }
                }
                item { SelectField("Tax mode", draft.taxMode, listOf("EXCLUSIVE" to "Exclusive", "INCLUSIVE" to "Inclusive")) { vm.edit(draft.copy(taxMode = it)) } }
                itemsIndexed(draft.lines) { index, line -> PurchaseLine(index, line, draft, state, sourceLines, vm) }
                item { OutlinedButton(onClick = vm::addLine) { Text("Add line") } }
                item { OutlinedTextField(draft.notes, { vm.edit(draft.copy(notes = it)) }, label = { Text("Notes") }) }
                item { Text("Totals, GST, stock valuation, and postings are authoritative only after the server response.", style = MaterialTheme.typography.bodySmall) }
            }
        }
    )
}

@Composable
private fun PurchaseLine(index: Int, line: SalesLineDraft, draft: PurchaseDraft, state: PurchaseState, sourceLines: List<JsonObject>, vm: AccountPurchaseViewModel) {
    val masters = when (line.lineType) {
        "MATERIAL" -> state.products
        "SERVICE" -> state.services
        "SUBCONTRACT" -> state.workPackages
        else -> emptyList()
    }
    ElevatedCard {
        Column(Modifier.padding(10.dp)) {
            if (draft.type == "DEBIT_NOTE") {
                SelectField("Original line", line.sourceCommercialLineId, sourceLines.map { it.str("id") to "${it.str("itemName")} · ${it.str("quantity")}" }) { id ->
                    val source = sourceLines.first { it.str("id") == id }
                    vm.line(index, line.copy(
                        sourceCommercialLineId = id,
                        lineType = source.str("lineType"),
                        sourceId = source.str("productId").ifBlank { source.str("serviceId").ifBlank { source.str("workPackageId") } },
                        itemName = source.str("itemName"),
                        quantity = source.str("quantity"),
                        rate = source.str("rate"),
                        taxRate = source.str("taxRate")
                    ))
                }
            }
            SelectField("Line type", line.lineType, listOf("MATERIAL" to "Material", "SERVICE" to "Service", "SUBCONTRACT" to "Subcontract", "CUSTOM" to "Custom")) { vm.line(index, line.copy(lineType = it, sourceId = "")) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { vm.line(index, line.copy(itemName = it)) }, label = { Text("Name") })
            } else {
                SelectField("Item", line.sourceId, masters.map { it.id to it.name }) { id ->
                    val master = masters.first { it.id == id }
                    vm.line(index, line.copy(sourceId = id, rate = master.rate.orEmpty(), taxRate = master.taxRate.orEmpty()))
                }
            }
            Row {
                OutlinedTextField(line.quantity, { vm.line(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { vm.line(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(line.taxRate, { vm.line(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            if (line.sourceId.isNotBlank() && masters.firstOrNull { it.id == line.sourceId }?.trackInventory == true) {
                SelectField("Warehouse", line.warehouseId, state.warehouses.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { vm.line(index, line.copy(warehouseId = it)) }
            }
            if (draft.type == "DEBIT_NOTE") OutlinedTextField(line.stockReturnQuantity, { vm.line(index, line.copy(stockReturnQuantity = it)) }, label = { Text("Physical return quantity") })
            if (draft.lines.size > 1) TextButton(onClick = { vm.remove(index) }) { Text("Remove") }
        }
    }
}
