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

 private fun itemOptions(kind:String="products")=buildJsonObject{put(kind,buildJsonArray{add(buildJsonObject{put("id","created");put("name","Committed item");put("salePrice","90071992547409.91");put("sellingRate","37.15");put("taxRate","18");put("unitId","unit");put("description","Master description")})})}
 @Test fun createdProductUsesCanonicalExactOptionsAndPreservesOtherDraftFields(){
  val result=quotationWithCreatedItem(draft,0,"created","products",itemOptions())!!
  assertEquals("created",result.lines[0].sourceId);assertEquals("90071992547409.91",result.lines[0].rate);assertEquals("5",result.lines[0].quantity)
  assertEquals(draft.notes,result.notes);assertEquals(draft.terms,result.terms);assertEquals(draft.creationRequestKey,result.creationRequestKey);assertEquals(draft.adjustments,result.adjustments);assertEquals("unit",result.lineMetadata[0]["unitId"]?.jsonPrimitive?.content)
 }
 @Test fun createdServiceUsesSellingRateAndKeepsSiblingLines(){
  val original=draft.copy(lines=draft.lines+SalesLineDraft(itemName="Other",quantity="2"))
  val result=quotationWithCreatedItem(original,0,"created","services",itemOptions("services"))!!
  assertEquals("SERVICE",result.lines[0].lineType);assertEquals("37.15",result.lines[0].rate);assertEquals(original.lines[1],result.lines[1])
 }
 @Test fun missingForeignOrUnresolvedItemCannotBeSelected(){
  assertNull(quotationWithCreatedItem(draft,0,"foreign","products",itemOptions()));assertNull(quotationWithCreatedItem(draft,9,"created","products",itemOptions()));assertNull(quotationWithCreatedItem(draft,0,"created","wrong",itemOptions()));assertNull(quotationWithCreatedItem(draft,0,"created","products",buildJsonObject{}))
 }

 @Test fun malformedOrWrongKindCanonicalRowsDoNotBecomeDraftLines(){
  val invalid=buildJsonObject{put("products",buildJsonArray{add(buildJsonObject{put("id","created");put("name","Invalid");put("salePrice","bad");put("taxRate","18")})})}
  assertNull(quotationWithCreatedItem(draft,0,"created","products",invalid));assertNull(quotationWithCreatedItem(draft,0,"created","services",itemOptions()))
 }
}
