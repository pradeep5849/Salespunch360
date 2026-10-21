package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class AccountReportDataTest {
    @Test fun gstRateKeepsPercentageSeparateFromCurrencyAndDropsStaleItemFilter(){
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"gst-rate","name":"GST Rate Report","group":"Business status","filters":[]}]}""").jsonObject
        assertEquals("gst-rate",accountReportCatalogue(options,"GST Rate").single().key)
        assertEquals(mapOf("branchId" to "branch"),accountReportRequestFilters(options,"gst-rate",mapOf("branchId" to "branch","productId" to "stale")))
        val data=Json.parseToJsonElement("""{"rows":[["CGST@9%","9%","₹121.50","₹0.00"]]}""").jsonObject
        assertEquals(listOf("CGST@9%","9%","₹121.50","₹0.00"),accountReportRows(data).single())
    }

    @Test fun partyGstUsesServerCatalogueAndPreservesSignedTaxAndScope() {
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"gst-party","name":"GST Report","group":"Business status","filters":[]}]}""").jsonObject
        assertEquals("gst-party",accountReportCatalogue(options,"GST Report").single().key)
        assertEquals(mapOf("from" to "2026-10-01","branchId" to "branch"),accountReportRequestFilters(options,"gst-party",mapOf("from" to "2026-10-01","branchId" to "branch","productId" to "stale")))
        val data=Json.parseToJsonElement("""{"rows":[["Party","Customer","₹12.15","₹0.00"],["Party","Vendor","₹0.00","-₹7.29"]]}""").jsonObject
        assertEquals("-₹7.29",accountReportRows(data)[1][3])
    }

    @Test fun discountReportRetainsSignedMoneyAndRejectsStaleItemScope() {
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"discount-party","name":"Discount Report","group":"Business status","filters":[]}]}""").jsonObject
        assertEquals("discount-party",accountReportCatalogue(options,"Discount Report").single().key)
        assertEquals(mapOf("from" to "2026-10-01"),accountReportRequestFilters(options,"discount-party",mapOf("from" to "2026-10-01","productId" to "stale")))
        val data=Json.parseToJsonElement("""{"rows":[["Customer","Customer","₹7.50","₹0.00"],["Vendor","Vendor","₹0.00","-₹4.50"]]}""").jsonObject
        assertEquals("-₹4.50",accountReportRows(data)[1][3])
    }

    @Test fun partyTradeKeepsCustomerVendorRowsAndOnlyPeriodBranchScope() {
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"sale-purchase-party","name":"Sale/Purchase by Party","group":"Party reports","filters":[]}]}""").jsonObject
        assertEquals("sale-purchase-party",accountReportCatalogue(options,"sale/purchase").single().key)
        assertEquals(mapOf("from" to "2026-10-01","to" to "2026-10-18","branchId" to "branch"),accountReportRequestFilters(options,"sale-purchase-party",mapOf("from" to "2026-10-01","to" to "2026-10-18","branchId" to "branch","productId" to "stale")))
        val data=Json.parseToJsonElement("""{"rows":[["Same name","Customer","₹75.00","₹0.00"],["Same name","Vendor","₹0.00","₹45.00"]]}""").jsonObject
        assertEquals(listOf(listOf("Same name","Customer","₹75.00","₹0.00"),listOf("Same name","Vendor","₹0.00","₹45.00")),accountReportRows(data))
    }

    @Test fun stockDetailRetainsDecimalStringsAndUsesOnlyDeclaredScope() {
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"stock-detail","name":"Stock Detail Report","group":"Item/Stock reports","filters":[]}]}""").jsonObject
        assertEquals("stock-detail",accountReportCatalogue(options,"stock detail").single().key)
        assertEquals(mapOf("from" to "2026-10-01","to" to "2026-10-18","branchId" to "branch"),accountReportRequestFilters(options,"stock-detail",mapOf("from" to "2026-10-01","to" to "2026-10-18","branchId" to "branch","projectId" to "unrelated")))
        val data=Json.parseToJsonElement("""{"rows":[["Pipe","Steel","kg","-3.0000","2.2501","1.0000","-1.7499"]]}""").jsonObject
        assertEquals(listOf("Pipe","Steel","kg","-3.0000","2.2501","1.0000","-1.7499"),accountReportRows(data).single())
    }
    @Test fun categoryStockReportUsesServerCatalogueAndRejectsUnrelatedFilters() {
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"stock-category","name":"Stock Summary by Item Category","group":"Item/Stock reports","filters":[]}]}""").jsonObject
        assertEquals("stock-category",accountReportCatalogue(options,"stock summary").single().key)
        assertEquals(emptySet<String>(),accountReportSpecificFilters(options,"stock-category"))
        assertEquals(mapOf("from" to "2026-10-18","to" to "2026-10-18","branchId" to "branch"),accountReportRequestFilters(options,"stock-category",mapOf("from" to "2026-10-18","to" to "2026-10-18","branchId" to "branch","projectId" to "project","productId" to "item")))
    }
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
    @Test fun moneyTypeIsRetainedBeforeMetadataArrivesAndNeverLeaksToAnotherReport() {
        val input=mapOf("from" to "2026-10-01","to" to "2026-10-31","accountType" to "BANK","branchId" to "branch")
        assertEquals("BANK",accountReportRequestFilters(buildJsonObject{},"cash-bank",input)["accountType"])
        assertFalse(accountReportRequestFilters(buildJsonObject{},"profit-loss",input).containsKey("accountType"))
        assertEquals("INVALID",accountReportRequestFilters(buildJsonObject{},"cash-bank",mapOf("accountType" to "INVALID"))["accountType"])
    }
    @Test fun reportRequestFiltersEnforceDeclaredDimensionsAndLifetimeProjectDates() {
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"cash-bank","filters":["accountType"]},{"key":"projects","filters":["projectId"]}]}""").jsonObject
        val input=mapOf("from" to "2026-10-01","to" to "2026-10-31","branchId" to "branch","projectId" to "project","accountType" to "CASH","vendorId" to "vendor","ownerId" to "owner","companyId" to "foreign")
        assertEquals(setOf("from","to","branchId","accountType"),accountReportRequestFilters(options,"cash-bank",input).keys)
        assertEquals(mapOf("branchId" to "branch","projectId" to "project"),accountReportRequestFilters(options,"projects",input))
    }
    @Test fun stockFiltersSurviveColdStartAndClearWhenChangingReport() {
        val input=mapOf("categoryId" to "UNCATEGORIZED","itemStatus" to "INACTIVE")
        assertEquals(input,accountReportRequestFilters(buildJsonObject{},"stock-detail",input))
        assertTrue(accountReportRequestFilters(buildJsonObject{},"stock-category",input).isEmpty())
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"stock-detail","filters":["categoryId","itemStatus"]}]}""").jsonObject
        assertEquals(input,accountReportRequestFilters(options,"stock-detail",input))
        assertTrue(accountReportRequestFilters(options,"stock-detail",mapOf("categoryId" to "","itemStatus" to "")).isEmpty())
    }
    @Test fun bankStatementKeepsSelectedBankWithoutLeakingItToOtherReports() {
        val input=mapOf("moneyAccountId" to "bank","from" to "2026-10-01")
        assertEquals(input,accountReportRequestFilters(buildJsonObject{},"bank-statement",input))
        assertEquals(mapOf("from" to "2026-10-01"),accountReportRequestFilters(buildJsonObject{},"cash-bank",input))
        val options=Json.parseToJsonElement("""{"catalogue":[{"key":"bank-statement","filters":["moneyAccountId"]}]}""").jsonObject
        assertEquals(input,accountReportRequestFilters(options,"bank-statement",input))
    }
    @Test fun stockSummaryFiltersStayBoundToTheirSupportedDestinations() {
        val filters=mapOf("categoryId" to "UNCATEGORIZED","itemStatus" to "ACTIVE","stockLevel" to "NEGATIVE")
        assertEquals(filters,accountReportRequestFilters(buildJsonObject{},"stock-summary",filters))
        assertEquals(filters-"stockLevel",accountReportRequestFilters(buildJsonObject{},"low-stock-summary",filters))
        assertTrue(accountReportRequestFilters(buildJsonObject{},"bank-statement",filters).isEmpty())
    }
    @Test fun itemSearchRemainsScopedToStockReportsAndClearRemovesIt() {
        val filters=mapOf("itemSearch" to "Pipe & Bolt")
        for(report in listOf("stock-detail","stock-summary","low-stock-summary"))assertEquals(filters,accountReportRequestFilters(buildJsonObject{},report,filters))
        assertTrue(accountReportRequestFilters(buildJsonObject{},"bank-statement",filters).isEmpty())
        assertTrue(accountReportRequestFilters(buildJsonObject{},"stock-summary",mapOf("itemSearch" to "")).isEmpty())
    }
    @Test fun profitRowsKeepBillMetadataAndAuthorizedNativeDetailLinks() {
        val id="00000000-0000-4000-8000-000000000001"
        val data=Json.parseToJsonElement("""{"rows":[["CR-1","-0.5000 Nos","-25.00","-15.00","-10.00","40.00","18/10/2026","Customer","CREDIT_NOTE"]],"nativeRowLinks":["/workspace/account/sales/$id"]}""").jsonObject
        val row=accountReportRows(data).single()
        assertEquals(listOf("18/10/2026","Customer","CREDIT_NOTE"),row.drop(6))
        assertEquals("/workspace/account/sales/$id",accountReportDestination(accountReportLinks(data).single()))
    }
}
