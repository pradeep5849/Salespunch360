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
            Button(enabled = !state.saving, onClick = vm::save) { Text(if (state.saving) "Saving…" else "Create draft") }
        },
        dismissButton = { TextButton(enabled = !state.saving, onClick = vm::closeDraft) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
                if (state.saving) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                item { SelectField("Type", draft.type, state.types.map { it to it.replace('_', ' ') }) { vm.edit(draft.copy(type = it, sourceDocumentId = "", sourcePurchaseOrderId = "", projectId = "", projectBudgetLineId = "", materialTreatment = "", purpose = "INVENTORY_SALES", lines = listOf(SalesLineDraft(lineType = "MATERIAL")))) } }
                item { SelectField("Branch", draft.branchId, state.branches.map { it.id to it.name }) { vm.edit(draft.copy(branchId = it, vendorId = "", projectId = "", projectBudgetLineId = "", sourceDocumentId = "", sourcePurchaseOrderId = "", lines = draft.lines.map { line -> line.copy(warehouseId = "", sourceCommercialLineId = "", purchaseAllocations = emptyList()) })) } }
                item { SelectField("Vendor", draft.vendorId, state.vendors.map { it.id to it.name }) { vm.edit(draft.copy(vendorId = it, sourceDocumentId = "", sourcePurchaseOrderId = "", lines = draft.lines.map { line -> line.copy(sourceCommercialLineId = "") })) } }
                if (draft.type == "DEBIT_NOTE") item {
                    SelectField("Source purchase bill", draft.sourceDocumentId, sources.map { it.str("id") to it.str("documentNumber") }) { vm.edit(draft.copy(sourceDocumentId = it, projectId = "", projectBudgetLineId = "", materialTreatment = "", lines = listOf(SalesLineDraft(lineType = "MATERIAL")))) }
                }
                if (draft.type == "PURCHASE_BILL") item {
                    SelectField(
                        "Source purchase order",
                        draft.sourcePurchaseOrderId,
                        state.purchaseOrders.filter { it.str("branchId") == draft.branchId && it.str("vendorId") == draft.vendorId }.map { it.str("id") to it.str("documentNumber") }
                    ) { vm.edit(draft.copy(sourcePurchaseOrderId = it)) }
                }
                if(draft.type=="PURCHASE_BILL") { item { OutlinedTextField(draft.vendorInvoiceNumber,{vm.edit(draft.copy(vendorInvoiceNumber=it))},label={Text("Vendor invoice number")}) }; item { OutlinedTextField(draft.vendorInvoiceDate,{vm.edit(draft.copy(vendorInvoiceDate=it))},label={Text("Vendor invoice date")}) } }
                item { OutlinedTextField(draft.issueDate, { vm.edit(draft.copy(issueDate = it)) }, label = { Text("Issue date") }) }
                item { OutlinedTextField(draft.postingDate, { vm.edit(draft.copy(postingDate = it)) }, label = { Text("Accounting date") }) }
                item { OutlinedTextField(draft.paymentTerms, { vm.edit(draft.copy(paymentTerms = it)) }, label = { Text("Payment terms") }) }
                item { OutlinedTextField(draft.grnReference, { vm.edit(draft.copy(grnReference = it)) }, label = { Text("GRN / challan reference") }) }
                item { OutlinedTextField(draft.dueDate, { vm.edit(draft.copy(dueDate = it)) }, label = { Text("Due date") }) }
                if(draft.type=="PURCHASE_BILL"&&state.projects.isNotEmpty())item{Column{Text("Purchase For");SingleChoiceSegmentedButtonRow{SegmentedButton(selected=draft.purpose!="PROJECT",onClick={vm.edit(draft.copy(purpose="INVENTORY_SALES",projectId="",projectBudgetLineId="",materialTreatment=""))},shape=SegmentedButtonDefaults.itemShape(0,2)){Text("Regular")};SegmentedButton(selected=draft.purpose=="PROJECT",onClick={vm.edit(draft.copy(purpose="PROJECT",materialTreatment=""))},shape=SegmentedButtonDefaults.itemShape(1,2)){Text("Project")}}}}
                if (draft.type != "DEBIT_NOTE") {
                    if (draft.purpose == "PROJECT") {
                        item { SelectField("Project", draft.projectId, state.projects.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { vm.edit(draft.copy(projectId = it, projectBudgetLineId = "")) } }
                        item { SelectField("Budget line", draft.projectBudgetLineId, state.projectBudgetLines.filter { it.str("projectId") == draft.projectId }.map { it.str("id") to it.str("title") }) { vm.edit(draft.copy(projectBudgetLineId = it)) } }
                        item { SelectField("Material treatment", draft.materialTreatment, listOf("" to "Direct to Project (default)", "RECEIVE_IN_INVENTORY" to "Receive in inventory", "DIRECT_TO_PROJECT" to "Direct to Project")) { vm.edit(draft.copy(materialTreatment = it)) } }
                    } else item { SelectField("Advanced purchase purpose", draft.purpose, listOf("INVENTORY_SALES" to "Inventory / Sales", "GENERAL_OFFICE" to "General / Office", "FIXED_ASSET" to "Fixed Asset", "MIXED" to "Mixed Allocation")) { vm.edit(draft.copy(purpose = it, projectId = "", projectBudgetLineId = "", materialTreatment = "")) } }
                }

                item {
                    SelectField("Classification", draft.classification, listOf("PURCHASE_COST" to "Purchase cost", "GENERAL_EXPENSES" to "General expenses", "FIXED_ASSET" to "Fixed asset")) { vm.edit(draft.copy(classification = it)) }
                }
                item { SelectField("Tax mode", draft.taxMode, listOf("EXCLUSIVE" to "Exclusive", "INCLUSIVE" to "Inclusive")) { vm.edit(draft.copy(taxMode = it)) } }
                itemsIndexed(draft.lines) { index, line -> PurchaseLine(index, line, draft, state, sourceLines, vm) }
                item { OutlinedButton(enabled = !state.saving, onClick = vm::addLine) { Text("Add line") } }
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
            if (draft.purpose == "MIXED" && draft.type != "DEBIT_NOTE") {
                Text("Line allocations", style = MaterialTheme.typography.titleSmall)
                line.purchaseAllocations.forEachIndexed { ai, allocation ->
                    fun change(value: PurchaseAllocationDraft) = vm.line(index, line.copy(purchaseAllocations = line.purchaseAllocations.mapIndexed { i, current -> if (i == ai) value else current }))
                    SelectField("Allocation ${ai + 1}", allocation.allocationType, listOf("INVENTORY" to "Inventory", "GENERAL_EXPENSE" to "General expense", "FIXED_ASSET" to "Fixed asset") + if (state.projects.isNotEmpty()) listOf("PROJECT" to "Project") else emptyList()) { change(allocation.copy(allocationType = it, projectId = "", projectBudgetLineId = "", warehouseId = "")) }
                    OutlinedTextField(allocation.quantity, { change(allocation.copy(quantity = it)) }, label = { Text("Allocated quantity") })
                    if (allocation.allocationType == "PROJECT") {
                        SelectField("Allocated Project", allocation.projectId, state.projects.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { change(allocation.copy(projectId = it, projectBudgetLineId = "")) }
                        SelectField("Allocated budget line", allocation.projectBudgetLineId, state.projectBudgetLines.filter { it.str("projectId") == allocation.projectId }.map { it.str("id") to it.str("title") }) { change(allocation.copy(projectBudgetLineId = it)) }
                        SelectField("Allocated material treatment", allocation.materialTreatment, listOf("DIRECT_TO_PROJECT" to "Direct to Project", "RECEIVE_IN_INVENTORY" to "Receive in inventory")) { change(allocation.copy(materialTreatment = it)) }
                    }
                    if (allocation.allocationType in listOf("INVENTORY", "PROJECT") && masters.firstOrNull { it.id == line.sourceId }?.trackInventory == true) {
                        SelectField("Allocation warehouse", allocation.warehouseId, state.warehouses.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { change(allocation.copy(warehouseId = it)) }
                    }
                    TextButton(enabled = !state.saving, onClick = { vm.line(index, line.copy(purchaseAllocations = line.purchaseAllocations.filterIndexed { i, _ -> i != ai })) }) { Text("Remove allocation") }
                }
                OutlinedButton(enabled = !state.saving, onClick = { vm.line(index, line.copy(purchaseAllocations = line.purchaseAllocations + PurchaseAllocationDraft(quantity = line.quantity, warehouseId = line.warehouseId))) }) { Text("Add allocation") }
            }

            if (draft.type == "DEBIT_NOTE") {
                SelectField("Original line", line.sourceCommercialLineId, sourceLines.map { it.str("id") to "${it.str("itemName")} · ${it.str("quantity")}" }) { id ->
                    val source = sourceLines.first { it.str("id") == id }
                    vm.line(index, purchaseSourceLine(source))
                }
            }
            SelectField("Line type", line.lineType, listOf("MATERIAL" to "Material", "SERVICE" to "Service", "SUBCONTRACT" to "Subcontract", "CUSTOM" to "Custom")) { vm.line(index, SalesLineDraft(lineType = it)) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { vm.line(index, line.copy(itemName = it)) }, label = { Text("Name") })
            } else {
                SelectField("Item", line.sourceId, masters.map { it.id to it.name }) { id ->
                    val master = masters.first { it.id == id }
                    vm.line(index, line.copy(sourceId = id, rate = master.rate.orEmpty(), taxRate = master.taxRate.orEmpty(), batchId = "", serialNumberId = "", sourceCommercialLineId = "", purchaseAllocations = emptyList()))
                }
            }
            Row {
                OutlinedTextField(line.quantity, { vm.line(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { vm.line(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(line.taxRate, { vm.line(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            if (line.sourceId.isNotBlank() && masters.firstOrNull { it.id == line.sourceId }?.trackInventory == true) {
                SelectField("Warehouse", line.warehouseId, state.warehouses.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { vm.line(index, line.copy(warehouseId = it)) }
                val mode = masters.first { it.id == line.sourceId }.trackingMode
                if (mode == "BATCH") SelectField("Batch", line.batchId, state.batches.filter { it.str("productId") == line.sourceId }.map { it.str("id") to it.str("batchNumber") }) { vm.line(index, line.copy(batchId = it, serialNumberId = "")) }
                if (mode == "SERIAL") SelectField("Serial number", line.serialNumberId, state.serials.filter { it.str("productId") == line.sourceId }.map { it.str("id") to it.str("serialNumber") }) { vm.line(index, line.copy(serialNumberId = it, batchId = "", quantity = "1")) }
            }
            if (draft.type == "DEBIT_NOTE") OutlinedTextField(line.stockReturnQuantity, { vm.line(index, line.copy(stockReturnQuantity = it)) }, label = { Text("Physical return quantity") })
            if (draft.lines.size > 1) TextButton(onClick = { vm.remove(index) }) { Text("Remove") }
        }
    }
}
