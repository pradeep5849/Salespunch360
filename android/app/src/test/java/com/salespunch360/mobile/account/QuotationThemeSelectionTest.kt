package com.salespunch360.mobile.account
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test
class QuotationThemeSelectionTest{
 @Test fun namedLayoutAndAccentStayIndependent(){assertEquals("GST_6" to "#ABC123",quotationThemeSelection(Json.parseToJsonElement("""{"themes":[{"id":"GST_1"},{"id":"GST_6"}],"current":{"theme":"GST_6","color":"#abc123"}}""").jsonObject))}
 @Test fun legacyAccentSurvivesWithoutInventingALayoutIdentity(){assertEquals("GST_1" to "#ABC123",quotationThemeSelection(Json.parseToJsonElement("""{"themes":[{"id":"GST_1"}],"current":{"theme":"#abc123"}}""").jsonObject))}
 @Test fun unknownOrMalformedPreferencesUseAvailableSafeDefaults(){assertEquals("GST_1" to "#998BDF",quotationThemeSelection(Json.parseToJsonElement("""{"themes":[{"id":"GST_1"}],"current":{"theme":"INVALID","color":"url(test)"}}""").jsonObject))}
}
