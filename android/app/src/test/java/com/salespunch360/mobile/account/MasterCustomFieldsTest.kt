package com.salespunch360.mobile.account
import com.salespunch360.mobile.data.AccountCustomField
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.*
import org.junit.Test
class MasterCustomFieldsTest {
 @Test fun configuredChoiceAndRequiredFlagsReachNative(){val f=Json.decodeFromString<AccountCustomField>("""{"fieldKey":"supplier_group","label":"Supplier group","dataType":"SELECT","isRequired":true,"options":["Materials","Services"]}""");assertTrue(f.isRequired);assertEquals(listOf("Materials","Services"),f.options)}
 @Test fun legacyDefinitionsRetainCompatibleDefaults(){val f=Json.decodeFromString<AccountCustomField>("""{"fieldKey":"extra","label":"Extra","dataType":"TEXT"}""");assertFalse(f.isRequired);assertTrue(f.options.isEmpty())}
}
