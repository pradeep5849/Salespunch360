package com.salespunch360.mobile.data

import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class ReadOnlyCompanyProfileTest {
 @Test fun businessDetailsDecodeWithoutAdministrativeSettings() {
  val company=Json{ignoreUnknownKeys=true}.decodeFromString<CompanyProfile>("""{"name":"Business","primaryContactName":null,"primaryPhone":"1234567890","contactEmail":"business@example.invalid","enabledModules":["LEADS"],"teamStructure":"SALES_ONLY"}""")
  assertEquals("Business",company.name)
  assertNull(company.primaryContactName)
  assertEquals("business@example.invalid",company.contactEmail)
  assertEquals(listOf("LEADS"),company.enabledModules)
  assertEquals(TeamStructure.SALES_ONLY,company.teamStructure)
 }
}
