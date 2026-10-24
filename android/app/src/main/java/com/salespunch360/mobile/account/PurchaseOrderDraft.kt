package com.salespunch360.mobile.account
import kotlinx.serialization.json.JsonObject
/** Unsaved bill quantities; source provenance is rechecked at creation and posting. */
fun purchaseOrderDraft(preview:JsonObject,state:PurchaseState,id:String):PurchaseDraft{
 require("PURCHASE_BILL" in state.types&&preview.str("sourcePurchaseOrderId")==id){"Reload an available purchase order."}
 val branch=preview.str("branchId");val vendor=preview.str("partyId")
 require(state.branches.any{it.id==branch}&&state.vendors.any{it.id==vendor}){"The order branch or vendor is unavailable."}
 val lines=preview.array("lines").map{line->
  val kind=line.str("lineType");val source=line.str("sourceId");val masters=when(kind){"MATERIAL"->state.products;"SERVICE"->state.services;"SUBCONTRACT"->state.workPackages;else->emptyList()}
  require(kind in setOf("MATERIAL","SERVICE","SUBCONTRACT","CUSTOM")&&(kind=="CUSTOM"||masters.any{it.id==source})&&line.str("sourceOrderLineId").isNotBlank()){"An order item is unavailable."}
  SalesLineDraft(sourceOrderLineId=line.str("sourceOrderLineId"),lineType=kind,sourceId=source,itemName=line.str("itemName"),description=line.str("description"),specification=line.str("specification"),unitName=line.str("unitName"),unitSymbol=line.str("unitSymbol"),unitSelection=line.str("unitSelection").ifBlank{"PRIMARY"},secondaryUnitsPerBase=(line["unitConversionSnapshot"] as? JsonObject)?.str("secondaryUnitsPerBase").orEmpty(),quantity=line.str("quantity"),rate=line.str("rate"),discountType=line.str("discountType"),discountValue=line.str("discountValue"),taxRate=line.str("taxRate"),cessRate=line.str("cessRate"))
 }
 require(lines.isNotEmpty()){"The order has no remaining quantities."}
 return PurchaseDraft(type="PURCHASE_BILL",branchId=branch,vendorId=vendor,sourcePurchaseOrderId=id,projectId=preview.str("projectId"),projectBudgetLineId=preview.str("projectBudgetLineId"),materialTreatment=preview.str("materialTreatment"),purpose=preview.str("purchasePurpose"),classification=preview.str("purchaseClassification"),issueDate=preview.str("issueDate"),postingDate=preview.str("issueDate"),taxMode=preview.str("taxMode"),stateOfSupplyCode=preview.str("stateOfSupplyCode"),notes=preview.str("notes"),lines=lines)
}
