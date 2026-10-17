package com.salespunch360.mobile
import com.salespunch360.mobile.data.AccountMasterRecord
/** Never change a saved quotation's identity or silently choose a party from another branch. */
fun quotationWithCreatedParty(draft:QuotationDraft,party:AccountMasterRecord):QuotationDraft? {
 if(draft.id!=null||draft.revision||draft.branchId.isBlank()||party.branchId!=draft.branchId||party.id.isBlank()||!party.isActive)return null
 return draft.copy(customerId=party.id)
}
