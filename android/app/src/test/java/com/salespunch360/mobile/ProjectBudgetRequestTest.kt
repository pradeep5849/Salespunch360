package com.salespunch360.mobile

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ProjectBudgetRequestTest {
    @Test fun preservesMultipleBudgetLinesAndTheirReferencedIdentities() {
        val lines = listOf(ProjectBudgetLineDraft("original-id", "MATERIAL", "Steel", "Existing allocation", "600"), ProjectBudgetLineDraft(null, "LABOUR", "Labour", "", "100.25"))
        assertTrue(validProjectBudget(lines))
        val payload = projectBudgetPayload(lines)["lines"]!!.jsonArray
        assertEquals(2, payload.size)
        assertEquals("original-id", payload[0].jsonObject["id"]!!.jsonPrimitive.content)
        assertFalse(payload[1].jsonObject.containsKey("id"))
        assertEquals("100.25", payload[1].jsonObject["amount"]!!.jsonPrimitive.content)
    }
    @Test fun rejectsInvalidMoneyAndMissingNamesBeforePosting() {
        assertFalse(validProjectBudget(listOf(ProjectBudgetLineDraft(title = "Material", amount = "-1"))))
        assertFalse(validProjectBudget(listOf(ProjectBudgetLineDraft(title = "Material", amount = "NaN"))))
        assertFalse(validProjectBudget(listOf(ProjectBudgetLineDraft(title = " ", amount = "1"))))
        assertFalse(validProjectBudget(listOf(ProjectBudgetLineDraft(title = "Material", amount = "1.234"))))
    }
    @Test fun loadsFullBudgetWithoutFlatteningOrLosingDescriptions() {
        val project = buildJsonObject { put("budgetLines", projectBudgetPayload(listOf(ProjectBudgetLineDraft("id", "GENERAL", "Initial", "Keep", "100")))["lines"]!!) }
        assertEquals("Keep", projectBudgetLines(project).single().description)
        assertEquals("id", projectBudgetLines(project).single().id)
    }
}
