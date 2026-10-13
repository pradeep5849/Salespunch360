package com.salespunch360.mobile.account

import org.junit.Assert.*
import org.junit.Test

class UnitConversionRateTest{
 @Test fun exactRatesDoNotDependOnFloatingPointParsing(){
  listOf("0.0001","12","99999999999999.9999","0001.2500").forEach{assertTrue(it,validUnitConversionRate(it))}
  listOf("0","000.0000","-1","1e3","Infinity","0.00001","123456789012345","").forEach{assertFalse(it,validUnitConversionRate(it))}
 }
}
