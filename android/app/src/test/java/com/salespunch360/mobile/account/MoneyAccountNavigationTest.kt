package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class MoneyAccountNavigationTest {
    private val rows = listOf("BANK", "CASH", "PETTY_CASH").map { type -> buildJsonObject { put("id",type); put("type",type); put("isActive",false) } }
    @Test fun separatesBankAndCashWithoutDroppingInactiveHistory() {
        assertEquals(listOf(rows[0]),moneyAccountRowsForMode(rows,"bank-accounts"))
        assertEquals(listOf(rows[1]),moneyAccountRowsForMode(rows,"cash-in-hand"))
        assertEquals(rows,moneyAccountRowsForMode(rows,"accounts"))
    }
    @Test fun acceptsOnlySupportedAccountDestinations() {
        assertEquals("bank-accounts",moneyAccountListMode("/workspace/account/money/bank-accounts?branchId=branch"))
        assertEquals("cash-in-hand",moneyAccountListMode("/workspace/account/money/cash-in-hand"))
        assertEquals("accounts",moneyAccountListMode("/workspace/account/money/accounts"))
        assertNull(moneyAccountListMode("/workspace/account/money/accounts-unrelated"))
        assertNull(moneyAccountListMode("/workspace/account/money/loans"))
    }
}
