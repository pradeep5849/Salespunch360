package com.salespunch360.mobile.account
import com.salespunch360.mobile.data.AccountDashboard
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.*
import org.junit.Test
class InventoryNegativeBalanceTest {
 @Test fun negativeQuantityRemainsSignedInDashboardPreview(){val d=Json.decodeFromString<AccountDashboard>("""{"title":"Stock","period":"2026","lowStockItems":1,"lowStockPreview":[{"productId":"P","name":"Item","warehouse":"Warehouse","quantity":"-3.5"}]}""");assertEquals("-3.5",d.lowStockPreview.first().quantity);assertEquals(1,d.lowStockItems)}
}
