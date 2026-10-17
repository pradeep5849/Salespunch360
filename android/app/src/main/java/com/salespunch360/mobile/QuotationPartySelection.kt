package com.salespunch360.mobile
import com.salespunch360.mobile.data.AccountMasterRecord
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.JsonObject
/** Never change a saved quotation's identity or silently choose a party from another branch. */
fun quotationWithCreatedParty(draft:QuotationDraft,party:AccountMasterRecord):QuotationDraft? {
 if(draft.id!=null||draft.revision||draft.branchId.isBlank()||party.branchId!=draft.branchId||party.id.isBlank()||!party.isActive)return null
 return draft.copy(customerId=party.id)
}

/** Reject late responses from a different selection without converting exact currency to Double. */
fun quotationBalanceForDraft(draft:QuotationDraft,response:JsonObject):String? {
 if(response.str("partyId")!=draft.customerId||response.str("branchId")!=draft.branchId)return null
 return response.str("balance").takeIf{it.toBigDecimalOrNull()!=null}
}
