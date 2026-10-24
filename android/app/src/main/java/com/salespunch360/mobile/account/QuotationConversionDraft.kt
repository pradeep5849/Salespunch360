package com.salespunch360.mobile.account

import kotlinx.serialization.json.JsonObject

/** Read-only form preparation. Neither this codec nor opening a form saves a document. */
fun quotationConversionDraft(preview:JsonObject,options:SalesOptions,documentId:String,revisionId:String,targetType:String,date:String=java.time.LocalDate.now().toString()):SalesEditorDraft {
 require(targetType in options.types&&targetType in setOf("SALES_INVOICE","SALES_ORDER")&&preview.str("targetType")==targetType){"This estimate cannot be converted to that document type."}
 require(preview.str("sourceDocumentId")==documentId&&preview.str("sourceRevisionId")==revisionId&&preview.str("sourceStatus")=="APPROVED"){"Reload the current approved estimate before converting it."}
 val branch=preview.str("branchId");val customer=preview.str("partyId")
 require(options.branches.any{it.id==branch}&&options.customers.any{it.id==customer}){"The estimate’s branch or customer is unavailable."}
 val lines=preview.array("lines").map { line ->
  val type=line.str("lineType");val source=line.str("sourceId")
  val masters=when(type){"PRODUCT"->options.products;"SERVICE"->options.services;"WORK_PACKAGE"->options.workPackages;else->emptyList()}
  require(type in setOf("PRODUCT","SERVICE","WORK_PACKAGE","CUSTOM")&&(type=="CUSTOM"||masters.any{it.id==source})){"An estimate item is unavailable. Review the estimate before converting it."}
  SalesLineDraft(lineType=type,sourceId=source,itemName=line.str("itemName"),itemCode=line.str("itemCode"),description=line.str("description"),specification=line.str("specification"),unitName=line.str("unitName"),unitSymbol=line.str("unitSymbol"),quantity=line.str("quantity"),rate=line.str("rate"),discountType=line.str("discountType"),discountValue=line.str("discountValue"),taxRate=line.str("taxRate"),secondaryUnitsPerBase=masters.firstOrNull{it.id==source}?.secondaryUnitsPerBase.orEmpty(),quotationUnitReviewRequired=type=="PRODUCT")
 }
 require(lines.isNotEmpty()){ "The estimate has no billed items." }
 return options.defaultSalesDraft(targetType,branch).copy(issueDate=date,customerId=customer,projectId=preview.str("projectId"),billingName=preview.str("billingName"),stateOfSupplyCode=preview.str("stateOfSupplyCode"),taxMode=preview.str("taxMode"),roundOffAmount=preview.str("roundOffAmount"),sourceQuotationRevisionId=revisionId,quotationReference=preview["reference"] as? JsonObject,quotationNumber=preview.str("sourceNumber"),lines=lines)
}
fun quotationDisplayStatus(document:JsonObject)=if(document.str("convertedCommercialDocumentId").isNotBlank())"CLOSED" else document.str("status")
