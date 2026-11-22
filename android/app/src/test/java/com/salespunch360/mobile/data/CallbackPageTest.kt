package com.salespunch360.mobile.data

import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class CallbackPageTest {
    @Test fun decodesMixedPageAndRetainsNavigationMetadata() {
        val page = Json { ignoreUnknownKeys = true }.decodeFromString<CallbackPage>("""{"page":6,"pageSize":100,"hasMore":true,"items":[{"id":"call","leadId":"lead","callerUserId":"caller","callerName":"Caller","result":"CALL_BACK","calledAt":"2026-11-22T00:00:00Z","leadTitle":"Lead","ownerName":"Owner","followUpTaskId":null},{"id":"task","leadId":"lead","callerUserId":"admin","callerName":"Admin","result":"CALL_BACK","calledAt":"2026-11-22T00:00:00Z","leadTitle":"Lead","ownerName":"Owner","followUpTaskId":"task","notes":"Call tomorrow"}]}""")
        assertEquals(6,page.page)
        assertTrue(page.hasMore)
        assertNull(page.items[0].followUpTaskId)
        assertEquals("task",page.items[1].followUpTaskId)
        assertEquals("Call tomorrow",page.items[1].notes)
    }
}
