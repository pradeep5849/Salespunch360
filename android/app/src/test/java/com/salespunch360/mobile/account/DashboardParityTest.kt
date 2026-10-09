package com.salespunch360.mobile.account
import com.salespunch360.mobile.data.AccountDashboard
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.*
import org.junit.Test
class DashboardParityTest {
 @Test fun scopedActionsVisibilityAndExactTrendReachNative(){val d=Json{ignoreUnknownKeys=true}.decodeFromString<AccountDashboard>("""{"title":"A Dashboard","period":"2026","visibility":{"sales":true,"inventory":true},"links":{"items":"/workspace/account/inventory?branchId=A","lowStock":"/workspace/account/inventory/low-stock?branchId=A&asOf=2026-10-09","reports":null},"salesTrend":[{"month":"2026-08","total":"-100.00"},{"month":"2026-09","total":"0.00"},{"month":"2026-10","total":"50.00"}],"lowStockPreview":[{"productId":"P","name":"Tracked","warehouse":"Zero","quantity":"0"}]}""");assertTrue(d.visibility.inventory);assertFalse(d.visibility.expenses);assertNull(d.links.reports);assertTrue(d.links.lowStock!!.contains("asOf=2026-10-09"));assertEquals(listOf("-100.00","0.00","50.00"),d.salesTrend.map{it.total});assertEquals("Zero",d.lowStockPreview.first().warehouse)}
 @Test fun legacyResponsesHaveSafeUnavailableNavigationDefaults(){val d=Json.decodeFromString<AccountDashboard>("""{"title":"Legacy","period":"2026"}""");assertNull(d.links.items);assertFalse(d.visibility.inventory)}
}
