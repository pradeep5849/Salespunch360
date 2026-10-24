package com.salespunch360.mobile.account
import com.salespunch360.mobile.data.AccountHome
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.*
import org.junit.Test
class HomeSourceModelTest {
 private val base="\"id\":\"one\",\"partyName\":\"Buyer\",\"type\":\"EXPENSE\",\"documentNumber\":\"E1\",\"issueDate\":\"2026-10-11\",\"status\":\"DRAFT\",\"grandTotal\":\"123.45\",\"balanceDue\":\"0\""
 @Test fun readsSourceMetadataWithoutInventingDebtOrPrint(){val row=Json.decodeFromString<AccountHome>("{\"transactions\":[{$base,\"sourceKind\":\"EXPENSE\",\"detailHref\":\"/workspace/account/expenses/one\",\"showBalance\":false,\"printType\":null}]}").transactions.single();assertEquals("EXPENSE",row.sourceKind);assertEquals("/workspace/account/expenses/one",row.detailHref);assertFalse(row.showBalance);assertNull(row.printType)}
 @Test fun retainsLegacyCommercialDefaults(){val row=Json.decodeFromString<AccountHome>("{\"transactions\":[{$base}]}").transactions.single();assertEquals("COMMERCIAL",row.sourceKind);assertTrue(row.showBalance);assertEquals("Balance",row.balanceLabel)}
}
