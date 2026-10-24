package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class QuotationConversionDraftTest {
 private val preview=Json.parseToJsonElement("""{"sourceDocumentId":"estimate","sourceRevisionId":"revision","sourceStatus":"APPROVED","sourceNumber":"EST-22","targetType":"SALES_INVOICE","branchId":"branch","partyId":"customer","billingName":"Buyer billing","taxMode":"INCLUSIVE","roundOffAmount":"-0.40","stateOfSupplyCode":"29","reference":{"terms":"Full estimate terms","notes":"Reference only","paymentSchedule":[{"label":"Deposit","amount":"40","dueDescription":"On acceptance"}]},"lines":[{"lineType":"PRODUCT","sourceId":"product","itemName":"Steel","quantity":"2","unitName":"Box","unitSymbol":"box","rate":"59","discountType":"FIXED","discountValue":"10","taxRate":"18"}]}""").jsonObject
 private val options=SalesOptions(types=listOf("SALES_INVOICE","SALES_ORDER"),branches=listOf(SalesOption("branch","Main")),customers=listOf(SalesOption("customer","Buyer")),products=listOf(SalesOption("product","Steel",unitId="piece",secondaryUnitId="box",secondaryUnitsPerBase="0.1")))
 private fun changed(key:String,value:JsonElement)=JsonObject(preview+mapOf(key to value))
 @Test fun saleFormKeepsSourceAndFinancialValuesWithoutReceiptOrStockIdentity(){
  val draft=quotationConversionDraft(preview,options,"estimate","revision","SALES_INVOICE","2026-10-20")
  assertEquals("revision",draft.sourceQuotationRevisionId);assertEquals("2026-10-20",draft.issueDate);assertEquals("Buyer billing",draft.billingName);assertEquals("INCLUSIVE",draft.taxMode);assertEquals("-0.40",draft.roundOffAmount)
  assertEquals("Full estimate terms",draft.quotationReference?.str("terms"));assertFalse(draft.notes.contains("Reference only"));assertEquals("",draft.editingSourceId);assertEquals("",draft.copiedFromSaleId);assertEquals("",draft.receivedAmount)
  val line=draft.lines.single();assertEquals("2",line.quantity);assertEquals("59",line.rate);assertEquals("10",line.discountValue);assertTrue(line.quotationUnitReviewRequired);assertEquals("",line.warehouseId);assertEquals("",line.batchId);assertEquals("",line.serialNumberId)
  val payload=salesDraftPayload(draft);assertEquals("revision",payload.str("sourceQuotationRevisionId"));assertFalse(payload.containsKey("quotationReference"));assertFalse(payload.array("lines").single().containsKey("quotationUnitReviewRequired"));assertFalse(payload.array("lines").single().containsKey("secondaryUnitsPerBase"))
 }
 @Test fun orderPreparationIsUnconfirmedAndHasNoJournalOrReceipt(){val draft=quotationConversionDraft(changed("targetType",JsonPrimitive("SALES_ORDER")),options,"estimate","revision","SALES_ORDER");assertEquals("SALES_ORDER",draft.type);assertEquals("revision",draft.sourceQuotationRevisionId);assertFalse(salesDraftPayload(draft).containsKey("status"));assertFalse(salesDraftPayload(draft).containsKey("journalEntryId"))}
 @Test fun rejectsStaleUnapprovedOrMismatchedPreparation(){
  for((key,value)in listOf("sourceDocumentId" to "other","sourceRevisionId" to "old","sourceStatus" to "DRAFT","targetType" to "SALES_ORDER"))assertThrows(IllegalArgumentException::class.java){quotationConversionDraft(changed(key,JsonPrimitive(value)),options,"estimate","revision","SALES_INVOICE")}
 }
 @Test fun rejectsUnavailableBranchCustomerItemOrTarget(){
  for(o in listOf(options.copy(branches=emptyList()),options.copy(customers=emptyList()),options.copy(products=emptyList()),options.copy(types=emptyList())))assertThrows(IllegalArgumentException::class.java){quotationConversionDraft(preview,o,"estimate","revision","SALES_INVOICE")}
 }
 @Test fun newSaleAfterConversionHasNoSourceIdentity(){val fresh=options.defaultSalesDraft("SALES_INVOICE","branch");assertEquals("",fresh.sourceQuotationRevisionId);assertNull(fresh.quotationReference);assertFalse(salesDraftPayload(fresh).containsKey("sourceQuotationRevisionId"))}
 @Test fun closedProjectionPreservesOriginalApprovedStatus(){val closed=changed("convertedCommercialDocumentId",JsonPrimitive("posted-target"));assertEquals("CLOSED",quotationDisplayStatus(closed));assertEquals("APPROVED",quotationDisplayStatus(buildJsonObject{put("status","APPROVED");put("convertedCommercialDocumentId",JsonNull)}))}
}
