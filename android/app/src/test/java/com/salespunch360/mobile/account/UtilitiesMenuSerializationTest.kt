package com.salespunch360.mobile.account

import com.salespunch360.mobile.data.AccountNavigationItem
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UtilitiesMenuSerializationTest {
    @Test fun oldServerItemsRemainEnabled() {
        val item = Json.decodeFromString<AccountNavigationItem>("""{"label":"Import Items","href":"/workspace/account/utilities/import?type=ITEMS"}""")
        assertFalse(item.disabled)
    }
    @Test fun pendingServerItemsCannotBecomeEnabledLinks() {
        val item = Json.decodeFromString<AccountNavigationItem>("""{"label":"Messages","href":"#pending-messages","disabled":true}""")
        assertTrue(item.disabled)
    }
}
