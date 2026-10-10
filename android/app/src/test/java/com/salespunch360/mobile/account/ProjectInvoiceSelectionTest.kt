package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test

class ProjectInvoiceSelectionTest {
    private val options = SalesOptions(branches = listOf(SalesOption("default", "Default"), SalesOption("project-branch", "Project branch")), customers = listOf(SalesOption("customer", "Customer", branchId = "project-branch")), projects = listOf(SalesOption("project", "Site", branchId = "project-branch", customerId = "customer")))
    @Test fun selectsProjectBranchAndCustomerAndRetainsInvoiceIntent() {
        val selected = selectProjectForInvoice(SalesEditorDraft(branchId = "default", projectRequired = true), options, "project")!!
        assertEquals("project-branch", selected.branchId)
        assertEquals("customer", selected.customerId)
        assertEquals("project", selected.projectId)
        assertTrue(selected.projectRequired)
    }
    @Test fun deniesUnavailableProjectAndMismatchedCustomerScope() {
        val draft = SalesEditorDraft()
        assertNull(selectProjectForInvoice(draft, options.copy(projects = emptyList()), "project"))
        assertNull(selectProjectForInvoice(draft, options.copy(customers = listOf(options.customers.single().copy(branchId = "foreign"))), "project"))
        assertNull(selectProjectForInvoice(draft, options.copy(branches = emptyList()), "project"))
        for (status in listOf("COMPLETED", "CLOSED", "CANCELLED")) assertNull(selectProjectForInvoice(draft, options.copy(projects = listOf(options.projects.single().copy(status = status))), "project"))
    }
    @Test fun changesBranchWithoutDroppingItemsButClearsOldStockSelections() {
        val line = SalesLineDraft(sourceId = "item", warehouseId = "old", batchId = "old", serialNumberId = "old")
        val selected = selectProjectForInvoice(SalesEditorDraft(branchId = "default", lines = listOf(line)), options, "project")!!
        assertEquals("item", selected.lines.single().sourceId)
        assertEquals("", selected.lines.single().warehouseId)
        assertEquals("", selected.lines.single().batchId)
        assertEquals("", selected.lines.single().serialNumberId)
    }
}
