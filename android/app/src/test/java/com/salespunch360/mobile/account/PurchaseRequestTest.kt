package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class PurchaseRequestTest {
    private val project = SalesOption("project", "Project", branchId = "branch")
    private fun state() = PurchaseState(types = listOf("PURCHASE_BILL", "DEBIT_NOTE"), branches = listOf(SalesOption("branch", "Branch")), vendors = listOf(SalesOption("vendor", "Vendor")), projects = listOf(project), projectBudgetLines = listOf(buildJsonObject { put("id", "budget"); put("projectId", "project") }), warehouses = listOf(SalesOption("warehouse", "Warehouse", branchId = "branch")), products = listOf(SalesOption("item", "Material", trackInventory = true, trackingMode = "BATCH")), batches = listOf(buildJsonObject { put("id", "batch"); put("productId", "item") }))
    private fun draft() = PurchaseDraft(branchId = "branch", vendorId = "vendor", vendorInvoiceNumber = "SUP-1", vendorInvoiceDate = "2026-10-09", lines = listOf(SalesLineDraft(lineType = "MATERIAL", sourceId = "item", rate = "10", warehouseId = "warehouse", batchId = "batch")))

    @Test fun sendsProjectTreatmentAndTrackedIdentityWithoutDroppingOtherFields() {
        val draft = draft().copy(purpose = "PROJECT", projectId = "project", projectBudgetLineId = "budget", materialTreatment = "DIRECT_TO_PROJECT")
        assertNull(purchaseValidation(draft, state()))
        val payload = purchasePayload(draft)
        assertEquals("DIRECT_TO_PROJECT", payload.str("materialTreatment"))
        assertEquals("batch", payload.array("lines").single().str("batchId"))
        assertEquals("SUP-1", payload.str("vendorInvoiceNumber"))
    }
    @Test fun mixedAllocationsHaveIndependentScopedProjectAndWarehouseFields() {
        val allocations = listOf(PurchaseAllocationDraft(quantity = "0.4", warehouseId = "warehouse", projectId = "stale", projectBudgetLineId = "stale"), PurchaseAllocationDraft("PROJECT", "0.6", "project", "budget", "warehouse", "DIRECT_TO_PROJECT"))
        val draft = draft().copy(purpose = "MIXED", lines = draft().lines.map { it.copy(purchaseAllocations = allocations) })
        assertNull(purchaseValidation(draft, state()))
        val payload = purchasePayload(draft).array("lines").single().array("purchaseAllocations")
        assertFalse(payload[0].containsKey("projectId"))
        assertEquals("budget", payload[1].str("projectBudgetLineId"))
        assertEquals("DIRECT_TO_PROJECT", payload[1].str("materialTreatment"))
        assertNotNull(purchaseValidation(draft.copy(lines = draft.lines.map { it.copy(quantity = "2") }), state()))
        assertNotNull(purchaseValidation(draft, state().copy(projects = listOf(project.copy(branchId = "denied")))))
    }
    @Test fun adjustmentInheritsProjectAndCopiesSourcePhysicalIdentity() {
        val source = buildJsonObject { put("id", "line"); put("lineType", "MATERIAL"); put("productId", "item"); put("itemName", "Material"); put("quantity", "1"); put("rate", "10"); put("taxRate", "0"); put("warehouseId", "warehouse"); put("batchId", "batch") }
        val line = purchaseSourceLine(source).copy(stockReturnQuantity = "1")
        val draft = draft().copy(type = "DEBIT_NOTE", purpose = "PROJECT", projectId = "stale", projectBudgetLineId = "stale", sourceDocumentId = "bill", lines = listOf(line))
        val state = state().copy(sources = listOf(buildJsonObject { put("id", "bill"); put("type", "PURCHASE_BILL"); put("branchId", "branch"); put("vendorId", "vendor"); putJsonArray("lines") { add(source) } }))
        assertNull(purchaseValidation(draft, state))
        val payload = purchasePayload(draft)
        assertFalse(payload.containsKey("projectId"))
        assertFalse(payload.containsKey("projectBudgetLineId"))
        assertEquals("batch", payload.array("lines").single().str("batchId"))
        assertEquals("line", payload.array("lines").single().str("sourceCommercialLineId"))
        assertNotNull(purchaseValidation(draft.copy(lines = listOf(line.copy(stockReturnQuantity = "2"))), state))
    }
    @Test fun rejectsMissingIdentityInvalidDatesAndInvalidNumbersBeforeRequest() {
        val draft = draft()
        assertNotNull(purchaseValidation(draft.copy(lines = draft.lines.map { it.copy(batchId = "") }), state()))
        assertNotNull(purchaseValidation(draft.copy(issueDate = "2026-02-30"), state()))
        assertNotNull(purchaseValidation(draft.copy(lines = draft.lines.map { it.copy(quantity = "NaN") }), state()))
        assertNotNull(purchaseValidation(draft.copy(lines = draft.lines.map { it.copy(rate = "-1") }), state()))
        assertNotNull(purchaseValidation(draft.copy(vendorInvoiceDate = ""), state()))
    }
    @Test fun serialRequiresMatchingItemAndOneUnit() {
        val state = state().copy(products = listOf(state().products.single().copy(trackingMode = "SERIAL")), serials = listOf(buildJsonObject { put("id", "serial"); put("productId", "item") }))
        val draft = draft().copy(lines = draft().lines.map { it.copy(batchId = "", serialNumberId = "serial") })
        assertNull(purchaseValidation(draft, state))
        assertEquals("serial", purchasePayload(draft).array("lines").single().str("serialNumberId"))
        assertNotNull(purchaseValidation(draft.copy(lines = draft.lines.map { it.copy(quantity = "2") }), state))
    }
}
