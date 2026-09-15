package com.salespunch360.mobile.web

import org.junit.Assert.*
import org.junit.Test

class AccountWebPolicyTest {
    @Test
    fun `canonical Account root and children stay privileged`() {
        assertEquals(
            AccountNavigation.ACCOUNT,
            classifyAccountUrl("https://www.salespunch360.com/workspace/account"),
        )
        assertEquals(
            AccountNavigation.ACCOUNT,
            classifyAccountUrl("https://www.salespunch360.com/workspace/account/projects?id=1"),
        )
    }

    @Test
    fun `safe external https opens externally`() {
        assertEquals(
            AccountNavigation.EXTERNAL_HTTPS,
            classifyAccountUrl("https://example.com/help"),
        )
    }

    @Test
    fun `unsafe schemes are blocked`() {
        listOf(
            "http://www.salespunch360.com/workspace/account",
            "javascript:alert(1)",
            "file:///workspace/account",
            "content://provider/item",
            "intent://workspace/account",
            "data:text/html,test",
        ).forEach { assertEquals(AccountNavigation.BLOCKED, classifyAccountUrl(it)) }
    }

    @Test
    fun `lookalike and userinfo tricks are not privileged`() {
        assertEquals(
            AccountNavigation.EXTERNAL_HTTPS,
            classifyAccountUrl("https://www.salespunch360.com.evil.test/workspace/account"),
        )
        assertEquals(
            AccountNavigation.BLOCKED,
            classifyAccountUrl("https://www.salespunch360.com@evil.test/workspace/account"),
        )
    }

    @Test
    fun `backslash tricks are blocked`() {
        assertEquals(
            AccountNavigation.BLOCKED,
            classifyAccountUrl("https://www.salespunch360.com\\@evil.test/workspace/account"),
        )
        assertNull(
            accountRelativePathOrNull("/workspace/account/%5c@evil.test"),
        )
    }

    @Test
    fun `only frozen Account file resources are privileged`() {
        assertEquals(
            AccountNavigation.ACCOUNT_RESOURCE,
            classifyAccountUrl("https://www.salespunch360.com/api/project-documents/abc"),
        )
        assertEquals(
            AccountNavigation.ACCOUNT_RESOURCE,
            classifyAccountUrl("https://www.salespunch360.com/api/account/print/SALES_INVOICE/abc"),
        )
        assertEquals(
            AccountNavigation.BLOCKED,
            classifyAccountUrl("https://www.salespunch360.com/api/v1/mobile/bootstrap"),
        )
        assertTrue(
            isAllowedAccountDownloadUrl(
                "https://www.salespunch360.com/api/account/utilities/export/products",
            ),
        )
        assertFalse(
            isAllowedAccountDownloadUrl(
                "https://www.salespunch360.com/api/v1/mobile/reports",
            ),
        )
    }

    @Test
    fun `encoded path traversal is blocked`() {
        assertEquals(
            AccountNavigation.BLOCKED,
            classifyAccountUrl(
                "https://www.salespunch360.com/workspace/account/%2e%2e/admin",
            ),
        )
    }

    @Test
    fun `handoff is allowed only during controlled load`() {
        assertEquals(AccountNavigation.BLOCKED, classifyAccountUrl(HANDOFF_URL))
        assertEquals(
            AccountNavigation.HANDOFF,
            classifyAccountUrl(HANDOFF_URL, allowHandoff = true),
        )
    }

    @Test
    fun `sign in is session recovery not web login`() {
        assertEquals(
            AccountNavigation.SESSION_RECOVERY,
            classifyAccountUrl("https://www.salespunch360.com/sign-in"),
        )
    }

    @Test
    fun `deep links normalize to relative Account path only`() {
        assertEquals(
            "/workspace/account/projects?q=one",
            accountRelativePathOrNull(
                "https://www.salespunch360.com/workspace/account/projects?q=one#ignored",
            ),
        )
        assertEquals(
            "/workspace/account",
            accountRelativePathOrNull("/workspace/account"),
        )
        assertNull(accountRelativePathOrNull("https://evil.test/workspace/account"))
        assertNull(accountRelativePathOrNull("/workspace"))
    }

    @Test
    fun `handoff code is form encoded and never placed in URL`() {
        val code = "abc+def/ghi?"
        val body = handoffFormBody(code).toString(Charsets.UTF_8)
        assertEquals("code=abc%2Bdef%2Fghi%3F", body)
        assertFalse(HANDOFF_URL.contains(code))
    }

    @Test
    fun `canonical download host requires https`() {
        assertTrue(isCanonicalHttpsUrl("https://www.salespunch360.com/api/account/print/invoice/1"))
        assertFalse(isCanonicalHttpsUrl("http://www.salespunch360.com/api/account/print/invoice/1"))
        assertFalse(isCanonicalHttpsUrl("https://salespunch360.com/api/account/print/invoice/1"))
    }
}
