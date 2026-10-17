package com.salespunch360.mobile
import com.salespunch360.mobile.account.SalesLineDraft
import com.salespunch360.mobile.data.AccountMasterRecord
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class QuotationPartySelectionTest {
 private val draft=QuotationDraft(branchId="branch",customerId="previous",notes="Retain",terms="Terms",lines=listOf(SalesLineDraft(itemName="Saved line",quantity="5",rate="70",taxRate="18")),lineMetadata=listOf(buildJsonObject{put("specification","Original")}),adjustments=listOf(buildJsonObject{put("type","DISCOUNT");put("value","10")}))
 private val party=AccountMasterRecord(id="new",branchId="branch",name="Party")
 @Test fun createdPartyChangesOnlyCustomerAndPreservesDraftSnapshotsAndReplayIdentity(){assertEquals(draft.copy(customerId="new"),quotationWithCreatedParty(draft,party));assertEquals("previous",draft.customerId)}
 @Test fun wrongBranchInactiveOrUnsavedIdentitiesAreNotSelected(){for(row in listOf(party.copy(branchId="other"),party.copy(branchId=null),party.copy(isActive=false),party.copy(id="")))assertNull(quotationWithCreatedParty(draft,row))}
 @Test fun savedQuotationOrRevisionCannotChangeItsParty(){assertNull(quotationWithCreatedParty(draft.copy(id="saved"),party));assertNull(quotationWithCreatedParty(draft.copy(revision=true),party))}

 @Test fun partyBalancePreservesExactNegativeAndLargeAmounts(){
  val response=buildJsonObject{put("partyId",draft.customerId);put("branchId",draft.branchId);put("balance","-90071992547409.91")}
  assertEquals("-90071992547409.91",quotationBalanceForDraft(draft,response))
 }
 @Test fun latePartyOrBranchResponsesCannotBecomeTheSelectedBalance(){
  val response=buildJsonObject{put("partyId","previous");put("branchId","branch");put("balance","100.00")}
  assertNull(quotationBalanceForDraft(draft.copy(customerId="new"),response));assertNull(quotationBalanceForDraft(draft.copy(branchId="other"),response))
 }
 @Test fun missingOrInvalidBalancesAreUnavailableRatherThanZero(){
  for(amount in listOf("","not money")){val response=buildJsonObject{put("partyId",draft.customerId);put("branchId",draft.branchId);put("balance",amount)};assertNull(quotationBalanceForDraft(draft,response))}
 }
}
