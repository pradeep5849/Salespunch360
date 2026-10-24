package com.salespunch360.mobile.account

import java.math.BigDecimal
import kotlinx.serialization.json.JsonObject
data class StockSummaryMetrics(val itemCount:Int,val lowStockCount:Int,val value:BigDecimal)
fun stockSummaryMetrics(rows:List<JsonObject>):StockSummaryMetrics {
 var low=0;var value=BigDecimal.ZERO
 rows.forEach{row->
  val quantity=row.str("quantity").toBigDecimalOrNull()?:throw IllegalArgumentException("Invalid stock quantity")
  val threshold=row.str("threshold").toBigDecimalOrNull()?:throw IllegalArgumentException("Invalid stock threshold")
  val stockValue=row.str("value").toBigDecimalOrNull()?:throw IllegalArgumentException("Invalid stock value")
  if(quantity<=threshold)low++
  value+=stockValue
 }
 return StockSummaryMetrics(rows.size,low,value)
}
