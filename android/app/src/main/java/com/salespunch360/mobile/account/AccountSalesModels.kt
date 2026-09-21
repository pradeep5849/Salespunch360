package com.salespunch360.mobile.account

import kotlinx.serialization.json.*

data class SalesOption(val id:String,val name:String,val branchId:String?=null,val code:String?=null,val rate:String?=null,val taxRate:String?=null,val trackInventory:Boolean=false,val trackingMode:String="NONE")
data class SalesDocumentRow(val id:String,val type:String,val number:String,val party:String,val date:String,val status:String,val total:String)
data class SalesLineDraft(val lineType:String="PRODUCT",val sourceId:String="",val itemName:String="",val description:String="",val quantity:String="1",val rate:String="",val discountType:String="",val discountValue:String="0",val taxRate:String="",val warehouseId:String="",val sourceCommercialLineId:String="",val stockReturnQuantity:String="0")
data class SalesEditorDraft(val type:String="SALES_INVOICE",val branchId:String="",val customerId:String="",val sourceDocumentId:String="",val issueDate:String=java.time.LocalDate.now().toString(),val dueDate:String="",val taxMode:String="EXCLUSIVE",val stateOfSupplyCode:String="",val projectId:String="",val notes:String="",val tcsRate:String="0",val lines:List<SalesLineDraft> = listOf(SalesLineDraft()))
data class SalesOptions(val types:List<String> = emptyList(),val branches:List<SalesOption> = emptyList(),val customers:List<SalesOption> = emptyList(),val products:List<SalesOption> = emptyList(),val services:List<SalesOption> = emptyList(),val workPackages:List<SalesOption> = emptyList(),val warehouses:List<SalesOption> = emptyList(),val projects:List<SalesOption> = emptyList(),val sourceDocuments:List<JsonObject> = emptyList())
data class AccountSalesState(val loading:Boolean=true,val saving:Boolean=false,val query:String="",val typeFilter:String?=null,val rows:List<SalesDocumentRow> = emptyList(),val options:SalesOptions=SalesOptions(),val editor:SalesEditorDraft?=null,val detail:JsonObject?=null,val postingId:String?=null,val error:String?=null,val message:String?=null)

internal fun JsonObject.str(key:String)=this[key]?.jsonPrimitive?.contentOrNull.orEmpty()
internal fun JsonObject.bool(key:String)=this[key]?.jsonPrimitive?.booleanOrNull?:false
internal fun JsonObject.option(rateKey:String="salePrice")=SalesOption(str("id"),str("name"),str("branchId").ifBlank{null},str("code").ifBlank{null},str(rateKey).ifBlank{null},str("taxRate").ifBlank{null},bool("trackInventory"),str("trackingMode").ifBlank{"NONE"})
internal fun JsonObject.array(key:String)=this[key]?.jsonArray?.mapNotNull{it as? JsonObject}.orEmpty()
