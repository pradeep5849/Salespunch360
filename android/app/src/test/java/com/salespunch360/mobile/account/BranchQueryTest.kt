package com.salespunch360.mobile.account
import org.junit.Assert.assertEquals
import org.junit.Test
class BranchQueryTest {
 @Test fun selectedBranchIsCarriedToExpenseAndChequeDestinations() { assertEquals("branchId=branch-a",accountBranchQuery("/workspace/account/money/cheques","branch-a",false));assertEquals("branchId=branch-a",accountBranchQuery("/workspace/account/expenses","branch-a",false)) }
 @Test fun companyConsolidationIsCarriedWithoutAnImplicitBranch() { assertEquals("scope=all",accountBranchQuery("/workspace/account/money/cheques",null,true)) }
 @Test fun explicitDrilldownScopeIsPreserved() { assertEquals("branchId=branch-b&q=old",accountBranchQuery("/workspace/account/expenses?branchId=branch-b&q=old","branch-a",false));assertEquals("scope=all",accountBranchQuery("/workspace/account/expenses?scope=all","branch-a",false)) }
 @Test fun projectFilterIsPreservedWhenAddingBranchScope() { assertEquals("projectId=p&branchId=branch-a",accountBranchQuery("/workspace/account/expenses?projectId=p","branch-a",false));assertEquals("q=old",accountBranchQuery("/workspace/account/expenses?q=old",null,false)) }
}
