package com.salespunch360.mobile.account

import java.math.BigDecimal
import java.time.LocalDate
import kotlinx.serialization.json.*

/** Keep adjustment lineage and clear identities when a different item is selected. */
fun purchaseSourceLine(source: JsonObject) = SalesLineDraft(
    lineType = source.str("lineType"),
    sourceId = source.str("productId").ifBlank { source.str("serviceId").ifBlank { source.str("workPackageId") } },
    sourceCommercialLineId = source.str("id"),
    itemName = source.str("itemName"), quantity = source.str("quantity"),
    rate = source.str("rate"), taxRate = source.str("taxRate"),
    warehouseId = source.str("warehouseId"), batchId = source.str("batchId"),
    serialNumberId = source.str("serialNumberId")
)

fun purchaseValidation(draft: PurchaseDraft, state: PurchaseState): String? {
    fun number(value: String) = value.toBigDecimalOrNull()?.takeIf { it.precision() <= 24 && it.scale() <= 6 }
    fun validDate(value: String) = runCatching { LocalDate.parse(value) }.isSuccess
    if (draft.type !in state.types) return "This purchase type is unavailable."
    if (state.branches.none { it.id == draft.branchId }) return "Select an available branch."
    if (state.vendors.none { it.id == draft.vendorId }) return "Select an available vendor."
    if (!validDate(draft.issueDate) || listOf(draft.dueDate, draft.postingDate, draft.vendorInvoiceDate).any { it.isNotBlank() && !validDate(it) }) return "Enter dates in YYYY-MM-DD format."
    if (draft.type == "PURCHASE_BILL" && (draft.vendorInvoiceNumber.isBlank() || draft.vendorInvoiceDate.isBlank())) return "Vendor invoice number and date are required."
    if (draft.type == "DEBIT_NOTE" && state.sources.none { it.str("id") == draft.sourceDocumentId && it.str("type") == "PURCHASE_BILL" && it.str("branchId") == draft.branchId && it.str("vendorId") == draft.vendorId }) return "Select a purchase bill for this branch and vendor."
    fun projectValid(id: String, budget: String) = state.projects.any { it.id == id && it.branchId == draft.branchId } && (budget.isBlank() || state.projectBudgetLines.any { it.str("id") == budget && it.str("projectId") == id })
    if (draft.type != "DEBIT_NOTE" && draft.purpose == "PROJECT" && !projectValid(draft.projectId, draft.projectBudgetLineId)) return "Select an available Project in this branch."
    if (draft.lines.isEmpty() || draft.lines.size > 500) return "Add between 1 and 500 lines."
    for ((index, line) in draft.lines.withIndex()) {
        val prefix = "Line ${index + 1}: "
        val qty = number(line.quantity) ?: return prefix + "Enter a valid quantity."
        if (qty <= BigDecimal.ZERO) return prefix + "Quantity must be positive."
        if (line.rate.isNotBlank() && (number(line.rate)?.let { it >= BigDecimal.ZERO } != true)) return prefix + "Enter a valid non-negative rate."
        if (line.taxRate.isNotBlank() && (number(line.taxRate)?.let { it >= BigDecimal.ZERO && it <= BigDecimal("100") } != true)) return prefix + "GST must be between 0 and 100."
        val master = when (line.lineType) { "MATERIAL" -> state.products; "SERVICE" -> state.services; "SUBCONTRACT" -> state.workPackages; else -> emptyList() }.firstOrNull { it.id == line.sourceId }
        if (line.lineType == "CUSTOM") { if (line.itemName.isBlank()) return prefix + "Enter an item name." } else if (master == null) return prefix + "Select an available item."
        if (master?.trackInventory == true) {
            if (state.warehouses.none { it.id == line.warehouseId && it.branchId == draft.branchId }) return prefix + "Select a warehouse in this branch."
            if (master.trackingMode == "BATCH" && state.batches.none { it.str("id") == line.batchId && it.str("productId") == line.sourceId }) return prefix + "Select a batch for this item."
            if (master.trackingMode == "SERIAL" && (qty.compareTo(BigDecimal.ONE) != 0 || state.serials.none { it.str("id") == line.serialNumberId && it.str("productId") == line.sourceId })) return prefix + "Select a serial number and use quantity 1."
        }
        if (draft.type == "DEBIT_NOTE") {
            val source = state.sources.first { it.str("id") == draft.sourceDocumentId }.array("lines").firstOrNull { it.str("id") == line.sourceCommercialLineId }
            if (source == null || purchaseSourceLine(source).let { it.sourceId != line.sourceId || it.lineType != line.lineType }) return prefix + "Select a matching original line."
            val returned = number(line.stockReturnQuantity) ?: return prefix + "Enter a valid physical return quantity."
            if (returned < BigDecimal.ZERO || returned > qty) return prefix + "Physical return cannot exceed the correction quantity."
        } else if (draft.purpose == "MIXED") {
            if (line.purchaseAllocations.isEmpty()) return prefix + "Add allocations."
            var total = BigDecimal.ZERO
            for (allocation in line.purchaseAllocations) {
                val amount = number(allocation.quantity) ?: return prefix + "Enter a valid allocated quantity."
                if (amount <= BigDecimal.ZERO) return prefix + "Allocated quantity must be positive."
                total += amount
                if (allocation.allocationType == "PROJECT" && !projectValid(allocation.projectId, allocation.projectBudgetLineId)) return prefix + "Select an allocated Project in this branch."
                if (allocation.allocationType == "INVENTORY" && master?.trackInventory == true && state.warehouses.none { it.id == allocation.warehouseId && it.branchId == draft.branchId }) return prefix + "Select an allocation warehouse in this branch."
            }
            if (total.compareTo(qty) != 0) return prefix + "Allocated quantities must equal the line quantity."
        }
    }
    return null
}

fun purchasePayload(draft: PurchaseDraft) = buildJsonObject {
    put("type", draft.type); put("branchId", draft.branchId); put("partyId", draft.vendorId)
    fun optional(key: String, value: String) { if (value.isNotBlank()) put(key, value) }
    optional("sourceDocumentId", draft.sourceDocumentId); optional("sourcePurchaseOrderId", draft.sourcePurchaseOrderId)
    put("purchasePurpose", draft.purpose); put("purchaseClassification", draft.classification)
    if (draft.type != "DEBIT_NOTE" && draft.purpose == "PROJECT") {
        optional("projectId", draft.projectId); optional("projectBudgetLineId", draft.projectBudgetLineId)
        optional("materialTreatment", draft.materialTreatment)
    }
    optional("vendorInvoiceNumber", draft.vendorInvoiceNumber); optional("vendorInvoiceDate", draft.vendorInvoiceDate)
    optional("postingDate", draft.postingDate); optional("paymentTerms", draft.paymentTerms); optional("grnReference", draft.grnReference)
    put("issueDate", draft.issueDate); optional("dueDate", draft.dueDate)
    put("taxMode", draft.taxMode); optional("stateOfSupplyCode", draft.stateOfSupplyCode)
    put("reverseCharge", draft.reverseCharge); put("taxCreditTreatment", draft.taxCreditTreatment)
    put("tdsRate", draft.tdsRate); put("notes", draft.notes)
    putJsonArray("lines") {
        draft.lines.forEach { line -> add(buildJsonObject {
            put("lineType", line.lineType)
            fun field(key: String, value: String) { if (value.isNotBlank()) put(key, value) }
            field("sourceId", line.sourceId); field("itemName", line.itemName); field("description", line.description)
            put("quantity", line.quantity); field("rate", line.rate); field("taxRate", line.taxRate)
            if (line.discountType.isNotBlank()) { put("discountType", line.discountType); put("discountValue", line.discountValue) }
            field("warehouseId", line.warehouseId); field("batchId", line.batchId); field("serialNumberId", line.serialNumberId)
            if (draft.type == "DEBIT_NOTE") { field("sourceCommercialLineId", line.sourceCommercialLineId); put("stockReturnQuantity", line.stockReturnQuantity) }
            if (draft.type != "DEBIT_NOTE" && draft.purpose == "MIXED") putJsonArray("purchaseAllocations") {
                line.purchaseAllocations.forEach { allocation -> add(buildJsonObject {
                    put("allocationType", allocation.allocationType); put("quantity", allocation.quantity)
                    if (allocation.allocationType == "PROJECT") {
                        put("projectId", allocation.projectId); if (allocation.projectBudgetLineId.isNotBlank()) put("projectBudgetLineId", allocation.projectBudgetLineId)
                        put("materialTreatment", allocation.materialTreatment)
                    }
                    if (allocation.allocationType in listOf("INVENTORY", "PROJECT") && allocation.warehouseId.isNotBlank()) put("warehouseId", allocation.warehouseId)
                }) }
            }
        }) }
    }
}
