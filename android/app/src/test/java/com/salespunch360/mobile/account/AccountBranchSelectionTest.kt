package com.salespunch360.mobile.account

import org.junit.Assert.*
import org.junit.Test

class AccountBranchSelectionTest {
    @Test fun assignedBranchMayBeSelected() { assertTrue(isSelectableAccountBranch(setOf("first", "second"), false, "second", false)) }
    @Test fun foreignAndInactiveBranchesAreRejected() { assertFalse(isSelectableAccountBranch(setOf("first"), true, "foreign", false)); assertFalse(isSelectableAccountBranch(setOf("first"), true, "inactive", false)) }
    @Test fun consolidationRequiresServerCapability() { assertTrue(isSelectableAccountBranch(setOf("first", "second"), true, null, true)); assertFalse(isSelectableAccountBranch(setOf("first", "second"), false, null, true)) }
    @Test fun ambiguousAndMissingContextAreRejected() { assertFalse(isSelectableAccountBranch(setOf("first"), true, "first", true)); assertFalse(isSelectableAccountBranch(setOf("first"), true, null, false)) }
}
