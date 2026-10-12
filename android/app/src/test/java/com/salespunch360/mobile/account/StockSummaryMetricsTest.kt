package com.salespunch360.mobile.account
import kotlinx.serialization.json.*
import org.junit.Test
import org.junit.Assert.*
class StockSummaryMetricsTest {
 @Test fun preservesZeroStockInactiveAndSignedValuesWithoutFloatingPointLoss(){
  val rows=Json.parseToJsonElement("""[{"id":"inactive","active":false,"quantity":"1.25","threshold":"2","value":"9999999999999999.99"},{"id":"zero","quantity":"0","threshold":"0","value":"0.01"},{"id":"negative","quantity":"-1","threshold":"0","value":"-10"}]""").jsonArray.map{it.jsonObject}
  val result=stockSummaryMetrics(rows)
  assertEquals(3,result.itemCount);assertEquals(3,result.lowStockCount)
  assertEquals("9999999999999990.00",result.value.toPlainString())
 }
 @Test fun anEmptyReportHasNoItemsOrStockValue(){assertEquals(StockSummaryMetrics(0,0,java.math.BigDecimal.ZERO),stockSummaryMetrics(emptyList()))}
 @Test(expected=IllegalArgumentException::class) fun malformedValuesAreNotSilentlyCountedAsZero(){stockSummaryMetrics(listOf(buildJsonObject{put("quantity","0");put("threshold","0");put("value","invalid")}))}
}
