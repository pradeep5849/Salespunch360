package com.salespunch360.mobile.account

fun isSelectableAccountBranch(availableIds: Set<String>, canConsolidate: Boolean, branchId: String?, companyWide: Boolean): Boolean =
    if (companyWide) canConsolidate && branchId == null else branchId != null && branchId in availableIds
