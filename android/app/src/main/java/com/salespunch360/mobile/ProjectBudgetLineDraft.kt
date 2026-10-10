package com.salespunch360.mobile

import kotlinx.serialization.json.*

data class ProjectBudgetLineDraft(
    val id: String? = null,
    val category: String = "GENERAL",
    val title: String = "",
    val description: String = "",
    val amount: String = "0",
)

fun projectBudgetLines(project: JsonObject): List<ProjectBudgetLineDraft> =
    project["budgetLines"]?.jsonArray?.map { element ->
        val row = element.jsonObject
        fun field(key: String) = row[key]?.jsonPrimitive?.contentOrNull.orEmpty()
        ProjectBudgetLineDraft(field("id").ifBlank { null }, field("category"), field("title"), field("description"), field("amount"))
    }.orEmpty()

fun validProjectBudget(lines: List<ProjectBudgetLineDraft>): Boolean =
    lines.size <= 250 && lines.all { row ->
        row.category.trim().length in 1..120 && row.title.trim().length in 1..240 &&
            row.description.length <= 2000 && Regex("^[0-9]{1,16}(\\.[0-9]{1,2})?$").matches(row.amount)
    }

fun projectBudgetPayload(lines: List<ProjectBudgetLineDraft>) = buildJsonObject {
    putJsonArray("lines") {
        lines.forEach { row -> add(buildJsonObject {
            row.id?.let { put("id", it) }
            put("category", row.category.trim())
            put("title", row.title.trim())
            put("description", row.description.trim())
            put("amount", row.amount)
        }) }
    }
}
