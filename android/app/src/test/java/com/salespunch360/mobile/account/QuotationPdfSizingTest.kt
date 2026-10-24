package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class QuotationPdfSizingTest{
 @Test fun portraitAndLandscapeBoundOneVisiblePage(){
  assertEquals(1130 to 1600,quotationPdfPageSize(595,842))
  assertEquals(1600 to 1130,quotationPdfPageSize(842,595))
  assertEquals(1600 to 1,quotationPdfPageSize(100000,1))
 }
 @Test fun invalidDimensionsAreRejected(){
  assertThrows(IllegalArgumentException::class.java){quotationPdfPageSize(0,842)}
  assertThrows(IllegalArgumentException::class.java){quotationPdfPageSize(595,-1)}
  assertThrows(IllegalArgumentException::class.java){quotationPdfPageSize(595,842,0)}
 }
}
