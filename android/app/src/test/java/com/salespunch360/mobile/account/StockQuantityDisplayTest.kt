package com.salespunch360.mobile.account

import java.math.BigDecimal
import org.junit.Assert.assertEquals
import org.junit.Test

class StockQuantityDisplayTest {
    @Test fun honorsAllSupportedDecimalsAndNegativeSign() {
        listOf("-12", "-12.3", "-12.35", "-12.346", "-12.3457").forEachIndexed { decimals, expected ->
            assertEquals(expected, formatStockQuantity(BigDecimal("-12.34567"), decimals))
        }
    }
    @Test fun zeroAndPositiveFractionUseStableDecimalNotation() {
        assertEquals("0.0000", formatStockQuantity(BigDecimal.ZERO, 4))
        assertEquals("0.125", formatStockQuantity(BigDecimal("0.125"), 3))
        assertEquals("1.01", formatStockQuantity(BigDecimal("1.005"), 2))
        assertEquals("100000000000000.00", formatStockQuantity(BigDecimal("99999999999999.995"), 2))
        assertEquals("1000000.00", formatStockQuantity(BigDecimal("1E+6"), 2))
    }
    @Test fun preservesNegativeSignWhenDisplayRoundsToZero() {
        assertEquals("-0", formatStockQuantity(BigDecimal("-0.1"), 0))
        assertEquals("-0.00", formatStockQuantity(BigDecimal("-0.001"), 2))
    }
    @Test fun displayNeverMutatesUnderlyingPrecision() {
        val quantity = BigDecimal("-1.12345678")
        assertEquals("-1.12", formatStockQuantity(quantity, 2))
        assertEquals(BigDecimal("-1.12345678"), quantity)
    }
}
