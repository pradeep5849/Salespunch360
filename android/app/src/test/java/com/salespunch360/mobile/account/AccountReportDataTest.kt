package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class AccountReportDataTest {
    @Test fun suppliedReportResponseRetainsPrimitiveNamesColumnsAndArrayRows() {
        val options=Json.parseToJsonElement("""{"reports":["profit-loss","profit-withdrawal"]}""").jsonObject
        assertEquals(listOf("profit-loss","profit-withdrawal"),accountReportNames(options))
        val report=Json.parseToJsonElement("""{"columns":["Owner","Amount"],"rows":[["Owner A","₹ 100.00"],["Owner B",0]]}""").jsonObject
        assertEquals(listOf("Owner","Amount"),accountReportColumns(report))
        assertEquals(listOf(listOf("Owner A","₹ 100.00"),listOf("Owner B","0")),accountReportRows(report))
    }
    @Test fun laterFilterEditsDoNotChangeDisplayedResultsExportRequest() {
        val filters=mutableMapOf("from" to "2026-04-01","to" to "2026-10-11")
        val shown=AppliedAccountReport("profit-withdrawal",filters)
        filters["to"]="2026-12-31"
        assertEquals("2026-10-11",shown.filters["to"])
        assertEquals("profit-withdrawal",shown.report)
    }
    @Test fun catalogueSearchAndFavouritesUseServerMetadata(){val options=Json.parseToJsonElement("""{"catalogue":[{"key":"profit-withdrawal","name":"Profit Withdrawal","group":"Owners & Partners"},{"key":"tax","name":"GST Report","group":"Tax"}],"favourites":["tax"]}""").jsonObject;assertEquals(listOf("profit-withdrawal"),accountReportCatalogue(options,"OWNERS").map{it.key});assertEquals(setOf("tax"),accountReportFavourites(options));assertTrue(accountReportCatalogue(options,"missing").isEmpty())}
    @Test fun legacyOptionsStillOfferReportNavigation(){val options=Json.parseToJsonElement("""{"reports":["profit-loss"]}""").jsonObject;assertEquals("profit-loss",accountReportCatalogue(options).single().key);assertTrue(accountReportFavourites(options).isEmpty())}
    @Test fun rowLinksKeepPrimitiveUrlsAndTheirOriginalRowPositions(){val data=Json.parseToJsonElement("""{"rowLinks":[null,"/workspace/account/money/capital/owner"]}""").jsonObject;assertEquals(listOf("","/workspace/account/money/capital/owner"),accountReportLinks(data))}
    @Test fun reportDestinationsAllowInternalDocumentsAndRejectExternalOrMalformedPaths(){val id="00000000-0000-0000-0000-000000000001";assertEquals("/workspace/account/sales/$id",accountReportDestination("/workspace/account/sales/$id"));assertEquals("/workspace/account/purchases/$id",accountReportDestination("/workspace/account/purchases/$id"));assertEquals("/workspace/account/expenses/$id",accountReportDestination("/workspace/account/expenses/$id"));assertNull(accountReportDestination("https://example.test/sales/$id"));assertNull(accountReportDestination("/workspace/account/sales/../../settings"))}
    @Test fun reportFilterMetadataDoesNotReintroduceIgnoredDimensions(){val options=Json.parseToJsonElement("""{"catalogue":[{"key":"tax","filters":[]},{"key":"profit-withdrawal","filters":["ownerId"]}]}""").jsonObject;assertEquals(emptySet<String>(),accountReportSpecificFilters(options,"tax"));assertEquals(setOf("ownerId"),accountReportSpecificFilters(options,"profit-withdrawal"));assertNull(accountReportSpecificFilters(buildJsonObject{},"tax"))}
    @Test fun purchaseRegisterUsesServerVendorFilterAndNativePurchaseDestination() {
        val id="00000000-0000-4000-8000-000000000001"
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"purchase-register","name":"Purchase Register","group":"Transaction","filters":["vendorId"]}]}""").jsonObject
        assertEquals("purchase-register",accountReportCatalogue(options,"register").single().key)
        assertEquals(setOf("vendorId"),accountReportSpecificFilters(options,"purchase-register"))
        val data=Json.parseToJsonElement("""{"rowLinks":["/workspace/account/transactions/$id"],"nativeRowLinks":["/workspace/account/purchases/$id"]}""").jsonObject
        assertEquals("/workspace/account/purchases/$id",accountReportDestination(accountReportLinks(data).single()))
    }
}
