package com.salespunch360.mobile.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SecureSessionRaceTest {
    @Test
    fun rejectedTokenMayInvalidateOnlyItself() {
        assertTrue(shouldInvalidateRejectedToken("old-token", "old-token"))
        assertFalse(shouldInvalidateRejectedToken("new-token", "old-token"))
        assertFalse(shouldInvalidateRejectedToken(null, "old-token"))
    }
}
