package com.salespunch360.mobile.data

import org.junit.Assert.*
import org.junit.Test

class WorkspaceStateTest {
    private fun bootstrap(
        salesRole: MobileRole? = null,
        accountRole: AccountRole? = null,
        authorized: List<Workspace>,
        fieldEnabled: Boolean = false,
    ) = Bootstrap(
        user = MobileUser(
            id = "user",
            name = "User",
            email = "u@example.com",
            salesRole = salesRole,
            accountRole = accountRole,
        ),
        company = CompanyBrand("Acme"),
        features = Features(
            attendanceEnabled = fieldEnabled,
            gpsTrackingEnabled = fieldEnabled,
            fieldWorkEnabled = fieldEnabled,
        ),
        capabilities = Capabilities(),
        entitlement = Entitlement(
            state = "ACTIVE",
            operationalWritesAllowed = true,
        ),
        attendance = null,
        productEdition = when {
            authorized.containsAll(listOf(Workspace.SALES, Workspace.ACCOUNT)) ->
                ProductEdition.SALESPUNCH360_PLUS
            Workspace.ACCOUNT in authorized -> ProductEdition.SALESPUNCH360_ACCOUNT
            else -> ProductEdition.SALESPUNCH360
        },
        authorizedWorkspaces = authorized,
        canSwitchWorkspace = authorized.size == 2,
    )

    @Test
    fun `Sales-only resolves to Sales`() {
        val data = bootstrap(MobileRole.SALES, authorized = listOf(Workspace.SALES))
        assertEquals(setOf(Workspace.SALES), validatedWorkspaces(data))
        assertEquals(Workspace.SALES, resolveWorkspace(validatedWorkspaces(data), null))
    }

    @Test
    fun `Account-only resolves to Account and never invents Sales`() {
        val data = bootstrap(
            accountRole = AccountRole.ACCOUNTANT,
            authorized = listOf(Workspace.ACCOUNT),
        )
        assertEquals(setOf(Workspace.ACCOUNT), validatedWorkspaces(data))
        assertEquals(Workspace.ACCOUNT, resolveWorkspace(validatedWorkspaces(data), Workspace.SALES))
        assertFalse(data.features.fieldWorkEnabled)
    }

    @Test
    fun `Plus defaults to Sales without preference`() {
        val data = bootstrap(
            salesRole = MobileRole.SALES,
            accountRole = AccountRole.ACCOUNT_ADMIN,
            authorized = listOf(Workspace.SALES, Workspace.ACCOUNT),
        )
        assertEquals(Workspace.SALES, resolveWorkspace(validatedWorkspaces(data), null))
    }

    @Test
    fun `Plus restores only an authorized preference`() {
        val data = bootstrap(
            salesRole = MobileRole.SALES,
            accountRole = AccountRole.ACCOUNT_ADMIN,
            authorized = listOf(Workspace.SALES, Workspace.ACCOUNT),
        )
        assertEquals(
            Workspace.ACCOUNT,
            resolveWorkspace(validatedWorkspaces(data), Workspace.ACCOUNT),
        )
        assertEquals(
            Workspace.SALES,
            resolveWorkspace(validatedWorkspaces(data), Workspace.SALES),
        )
    }

    @Test
    fun `stale preference falls back to remaining workspace`() {
        val accountOnly = bootstrap(
            accountRole = AccountRole.PROJECT_MANAGER,
            authorized = listOf(Workspace.ACCOUNT),
        )
        assertEquals(
            Workspace.ACCOUNT,
            resolveWorkspace(validatedWorkspaces(accountOnly), Workspace.SALES),
        )
    }

    @Test
    fun `workspace list cannot grant Sales without Sales role`() {
        val inconsistent = bootstrap(
            accountRole = AccountRole.DATA_ENTRY,
            authorized = listOf(Workspace.SALES, Workspace.ACCOUNT),
        )
        assertEquals(setOf(Workspace.ACCOUNT), validatedWorkspaces(inconsistent))
    }

    @Test
    fun `workspace list cannot grant Account without Account role`() {
        val inconsistent = bootstrap(
            salesRole = MobileRole.SALES,
            authorized = listOf(Workspace.SALES, Workspace.ACCOUNT),
        )
        assertEquals(setOf(Workspace.SALES), validatedWorkspaces(inconsistent))
    }

    @Test
    fun `no authoritative workspace fails closed`() {
        val data = bootstrap(authorized = emptyList())
        assertTrue(validatedWorkspaces(data).isEmpty())
        assertNull(resolveWorkspace(validatedWorkspaces(data), Workspace.SALES))
    }
}
