package com.salespunch360.mobile.account
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class OrderSaleDraftTest{
 private val preview=Json.parseToJsonElement("""{"sourceSalesOrderId":"order","orderNumber":"SO-1","branchId":"branch","partyId":"party","issueDate":"2026-10-21","taxMode":"EXCLUSIVE","lines":[{"sourceOrderLineId":"line","lineType":"CUSTOM","itemName":"Work","quantity":"3","rate":"10","unitSelection":"PRIMARY","taxRate":"0"}]}""").jsonObject
 private val options=SalesOptions(types=listOf("SALES_INVOICE"),branches=listOf(SalesOption("branch","Main")),customers=listOf(SalesOption("party","Buyer")))
 @Test fun retainsExactSourceAndRemainingQuantityWithoutPostedIdentity(){val d=orderSaleDraft(preview,options,"order");assertEquals("order",d.sourceSalesOrderId);assertEquals("line",d.lines.single().sourceOrderLineId);assertEquals("3",d.lines.single().quantity);assertEquals("10",d.lines.single().rate);assertEquals("",d.editingSourceId);assertEquals("",d.receivedAmount);val p=salesDraftPayload(d);assertEquals("order",p.str("sourceSalesOrderId"));assertEquals("line",p.array("lines").single().str("sourceOrderLineId"));assertFalse(p.containsKey("status"));assertFalse(p.containsKey("journalEntryId"))}
 @Test fun rejectsStaleOrUnavailableSource(){assertThrows(IllegalArgumentException::class.java){orderSaleDraft(preview,options,"other")};for(o in listOf(options.copy(branches=emptyList()),options.copy(customers=emptyList()),options.copy(types=emptyList())))assertThrows(IllegalArgumentException::class.java){orderSaleDraft(preview,o,"order")}}
 @Test fun rejectsMissingLineProvenanceAndEmptyQuantities(){for(lines in listOf(buildJsonArray{},buildJsonArray{add(buildJsonObject{put("lineType","CUSTOM")})})){val changed=JsonObject(preview+mapOf("lines" to lines));assertThrows(IllegalArgumentException::class.java){orderSaleDraft(changed,options,"order")}}}
 @Test fun freshSaleHasNoOrderAllocation(){val fresh=options.defaultSalesDraft("SALES_INVOICE","branch");assertFalse(salesDraftPayload(fresh).containsKey("sourceSalesOrderId"));assertFalse(salesDraftPayload(fresh).array("lines").any{it.containsKey("sourceOrderLineId")})}
}
