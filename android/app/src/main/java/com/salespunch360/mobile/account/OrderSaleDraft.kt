package com.salespunch360.mobile.account
import kotlinx.serialization.json.JsonObject
/** Unsaved source-linked quantities only. Server rechecks every allocation on Save. */
fun orderSaleDraft(preview:JsonObject,options:SalesOptions,id:String):SalesEditorDraft{
 require(preview.str("sourceSalesOrderId")==id&&"SALES_INVOICE" in options.types){"Reload an available sales order."}
 val branch=preview.str("branchId");val party=preview.str("partyId")
 require(options.branches.any{it.id==branch}&&options.customers.any{it.id==party}){"The order branch or customer is unavailable."}
 val lines=preview.array("lines").map{line->
  val type=line.str("lineType");val masters=when(type){"PRODUCT"->options.products;"SERVICE"->options.services;"WORK_PACKAGE"->options.workPackages;else->emptyList()}
  require(type in setOf("PRODUCT","SERVICE","WORK_PACKAGE","CUSTOM")&&(type=="CUSTOM"||masters.any{it.id==line.str("sourceId")})){"An order item is unavailable."}
  require(line.str("sourceOrderLineId").isNotBlank()){"The source order line is unavailable."}
  SalesLineDraft(sourceOrderLineId=line.str("sourceOrderLineId"),lineType=line.str("lineType"),sourceId=line.str("sourceId"),itemName=line.str("itemName"),itemCode=line.str("itemCode"),description=line.str("description"),specification=line.str("specification"),unitName=line.str("unitName"),unitSymbol=line.str("unitSymbol"),unitSelection=line.str("unitSelection").ifBlank{"PRIMARY"},secondaryUnitsPerBase=(line["unitConversionSnapshot"] as? JsonObject)?.str("secondaryUnitsPerBase").orEmpty(),quantity=line.str("quantity"),rate=line.str("rate"),discountType=line.str("discountType"),discountValue=line.str("discountValue"),taxRate=line.str("taxRate"),cessRate=line.str("cessRate"))
 }
 require(lines.isNotEmpty()){"The order has no remaining quantities."}
 return options.defaultSalesDraft("SALES_INVOICE",branch).copy(sourceSalesOrderId=id,orderNumber=preview.str("orderNumber"),customerId=party,issueDate=preview.str("issueDate"),projectId=preview.str("projectId"),billingName=preview.str("billingName"),taxMode=preview.str("taxMode"),stateOfSupplyCode=preview.str("stateOfSupplyCode"),notes=preview.str("notes"),roundOffAmount="0",lines=lines)
}
