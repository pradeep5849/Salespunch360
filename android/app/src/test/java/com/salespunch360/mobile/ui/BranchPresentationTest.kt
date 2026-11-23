package com.salespunch360.mobile.ui
import org.junit.Assert.*
import org.junit.Test
class BranchPresentationTest {
 @Test fun bankBranchDetailsRemainAvailableInSingleLocationMode(){assertFalse(isCompanyBranchControl("Bank branch name"));assertFalse(isCompanyBranchControl("Bank account"))}
 @Test fun companyLocationSelectorsShareTheSamePresentationPolicy(){listOf("Branch","Posting branch","Branch (optional)","Opening journal branch","Firm / company branch").forEach{assertTrue(isCompanyBranchControl(it))};assertFalse(isCompanyBranchControl("Document series"))}
}
