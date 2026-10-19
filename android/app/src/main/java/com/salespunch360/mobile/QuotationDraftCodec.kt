package com.salespunch360.mobile

import com.salespunch360.mobile.account.SalesLineDraft
import kotlinx.serialization.json.*

private fun JsonObject.text(key: String) = (get(key) as? JsonPrimitive)?.contentOrNull.orEmpty()
private fun JsonObject.rows(key: String) = (get(key) as? JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()
private fun JsonObject.selected(keys: Set<String>) = JsonObject(filterKeys { it in keys }.filterValues { it != JsonNull })
private val adjustmentKeys = setOf("type", "label", "valueType", "value", "taxable", "taxRate")
private val scheduleKeys = setOf("label", "valueType", "value", "dueDescription")

internal fun editedQuotationLine(draft: QuotationDraft, index: Int, line: SalesLineDraft): QuotationDraft {
    val old = draft.lines.getOrNull(index) ?: return draft
    val changedIdentity = old.lineType != line.lineType || old.sourceId != line.sourceId
    val replacement = if (changedIdentity) line.copy(unitName = "", unitSymbol = "") else line
    return draft.copy(
        lines = draft.lines.mapIndexed { i, current -> if (i == index) replacement else current },
        lineMetadata = draft.lines.indices.map { i ->
            if (i == index && changedIdentity) JsonObject(emptyMap())
            else draft.lineMetadata.getOrNull(i) ?: JsonObject(emptyMap())
        }
    )
}

internal fun removedQuotationLine(draft: QuotationDraft, index: Int): QuotationDraft {
    if (draft.lines.size <= 1 || index !in draft.lines.indices) return draft
    return draft.copy(
        lines = draft.lines.filterIndexed { i, _ -> i != index },
        lineMetadata = draft.lines.indices.filter { it != index }.map { draft.lineMetadata.getOrNull(it) ?: JsonObject(emptyMap()) }
    )
}

internal fun savedQuotationDraft(document: JsonObject, revision: JsonObject): QuotationDraft {
    val lines = revision.rows("lines")
    return QuotationDraft(
        stateOfSupplyCode=revision.text("stateOfSupplyCode"),
        roundOffEnabled=(revision["roundOffEnabled"] as? JsonPrimitive)?.booleanOrNull?:false,
        id = document.text("id"), revision = document.text("status") != "DRAFT",
        branchId = document.text("branchId"), customerId = document.text("customerId"),
        documentType = document.text("documentType"), issueDate = revision.text("issueDate").take(10),
        validUntil = revision.text("validUntil").take(10), terms = revision.text("terms"),
        inclusions = revision.text("inclusions"), exclusions = revision.text("exclusions"), notes = revision.text("notes"),
        customFields = (revision["customFields"] as? JsonObject)?.mapNotNull { (key, value) ->
            (value as? JsonPrimitive)?.contentOrNull?.let { key to it }
        }?.toMap().orEmpty(),
        lines = lines.map { line -> SalesLineDraft(
            lineType = line.text("lineType"),
            sourceId = line.text("productId").ifBlank { line.text("serviceId").ifBlank { line.text("workPackageId") } },
            itemName = line.text("itemName"), description = line.text("description"),
            unitName = line.text("unitName"), unitSymbol = line.text("unitSymbol"),
            quantity = line.text("quantity"), rate = line.text("rate"), discountType = line.text("discountType"),
            discountValue = line.text("discountValue").ifBlank { "0" }, taxRate = line.text("taxRate")
        ) },
        lineMetadata = lines.map { line -> buildJsonObject {
            line.text("id").takeIf { it.isNotBlank() }?.let { put("existingLineId", it) }
            line.text("unitId").takeIf { it.isNotBlank() }?.let { put("unitId", it) }
            put("specification", line.text("specification"))
        } },
        adjustments = revision.rows("adjustments").map { it.selected(adjustmentKeys) },
        paymentSchedule = revision.rows("paymentSchedule").map { it.selected(scheduleKeys) }
    )
}

internal fun freshQuotationAfterSave(draft: QuotationDraft) = QuotationDraft(branchId=draft.branchId,documentType=draft.documentType)

internal fun quotationDraftPayload(draft: QuotationDraft) = buildJsonObject {
    if(draft.id==null) put("creationRequestKey",draft.creationRequestKey)
    put("stateOfSupplyCode",draft.stateOfSupplyCode.takeIf{it.isNotBlank()}?.let{JsonPrimitive(it)}?:JsonNull)
    put("roundOffEnabled",draft.roundOffEnabled)
    put("branchId", draft.branchId); put("documentType", draft.documentType); put("customerId", draft.customerId)
    put("issueDate", draft.issueDate)
    draft.validUntil.takeIf { it.isNotBlank() }?.let { put("validUntil", it) }
    put("terms", draft.terms); put("inclusions", draft.inclusions); put("exclusions", draft.exclusions); put("notes", draft.notes)
    putJsonObject("customFields") { draft.customFields.forEach { (key, value) -> put(key, value) } }
    putJsonArray("lines") {
        draft.lines.forEachIndexed { index, line -> add(buildJsonObject {
            draft.lineMetadata.getOrNull(index)?.selected(setOf("existingLineId", "unitId", "specification"))?.forEach { (key, value) -> put(key, value) }
            put("lineType", line.lineType)
            line.sourceId.takeIf { it.isNotBlank() }?.let { put("sourceId", it) }
            line.itemName.takeIf { it.isNotBlank() }?.let { put("itemName", it) }
            put("description", line.description)
            line.unitName.takeIf { it.isNotBlank() }?.let { put("unitName", it) }
            line.unitSymbol.takeIf { it.isNotBlank() }?.let { put("unitSymbol", it) }
            put("quantity", line.quantity)
            line.rate.takeIf { it.isNotBlank() }?.let { put("rate", it) }
            line.taxRate.takeIf { it.isNotBlank() }?.let { put("taxRate", it) }
            line.discountType.takeIf { it.isNotBlank() }?.let { put("discountType", it); put("discountValue", line.discountValue) }
        }) }
    }
    put("adjustments", JsonArray(draft.adjustments.map { it.selected(adjustmentKeys) }))
    put("paymentSchedule", JsonArray(draft.paymentSchedule.map { it.selected(scheduleKeys) }))
}

internal fun editedQuotationDraft(previous:QuotationDraft, replacement:QuotationDraft):QuotationDraft =
    if(previous.id==null) replacement.copy(creationRequestKey=previous.creationRequestKey) else replacement.copy(id=previous.id,revision=previous.revision,branchId=previous.branchId,customerId=previous.customerId,documentType=previous.documentType)
