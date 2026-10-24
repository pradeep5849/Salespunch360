package com.salespunch360.mobile.account

import org.junit.Assert.*
import org.junit.Test

class FreeSaleLinesTest {
    @Test fun freeBatchUnitsKeepTrackingAndHaveZeroPriceAndDiscount() {
        val paid=SalesLineDraft(quantity="2",rate="100",batchId="batch",warehouseId="warehouse",discountType="FIXED",discountValue="10")
        val lines=saleLinesWithFreeItem(paid,"3","BATCH")
        assertEquals(paid,lines.first())
        assertEquals("batch",lines.last().batchId)
        assertEquals("warehouse",lines.last().warehouseId)
        assertEquals("3",lines.last().quantity)
        assertEquals("0",lines.last().rate)
        assertEquals("0",lines.last().discountValue)
    }
    @Test fun aFreeSerialMustBeDifferentFromPaidSerial() {
        val paid=SalesLineDraft(quantity="1",rate="100",serialNumberId="paid")
        assertEquals(listOf("paid","free"),saleLinesWithFreeItem(paid,"1","SERIAL","free").map{it.serialNumberId})
        assertTrue(runCatching{saleLinesWithFreeItem(paid,"1","SERIAL","paid")}.isFailure)
        assertTrue(runCatching{saleLinesWithFreeItem(paid,"2","SERIAL","free")}.isFailure)
        assertTrue(runCatching{saleLinesWithFreeItem(paid.copy(quantity="2"),"0","SERIAL")}.isFailure)
    }
    @Test fun invalidQuantitiesAndMissingBatchRemainEditableWithoutAddingLines() {
        assertTrue(runCatching{saleLinesWithFreeItem(SalesLineDraft(),"-1","NONE")}.isFailure)
        assertTrue(runCatching{saleLinesWithFreeItem(SalesLineDraft(),"abc","NONE")}.isFailure)
        assertTrue(runCatching{saleLinesWithFreeItem(SalesLineDraft(),"1","BATCH")}.isFailure)
        assertEquals(1,saleLinesWithFreeItem(SalesLineDraft(),"0","NONE").size)
    }
}
