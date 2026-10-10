package com.salespunch360.mobile.account

fun selectProjectForInvoice(draft: SalesEditorDraft, options: SalesOptions, projectId: String): SalesEditorDraft? {
    val project = options.projects.firstOrNull { it.id == projectId && it.status !in listOf("COMPLETED", "CLOSED", "CANCELLED") } ?: return null
    val customer = options.customers.firstOrNull { it.id == project.customerId && it.branchId == project.branchId } ?: return null
    val branch = project.branchId ?: return null
    if (options.branches.none { it.id == branch }) return null
    return draft.copy(projectId = project.id, customerId = customer.id, branchId = branch,
        lines = if (draft.branchId == branch) draft.lines else draft.lines.map { it.copy(warehouseId = "", batchId = "", serialNumberId = "") })
}
