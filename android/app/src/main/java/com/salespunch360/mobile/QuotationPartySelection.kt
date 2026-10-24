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

/** Resolve the committed identity only from fresh authorized options; keep exact rate text. */
fun quotationWithCreatedItem(draft:QuotationDraft,index:Int,id:String,kind:String,options:JsonObject):QuotationDraft? {
 if(id.isBlank()||index !in draft.lines.indices||kind !in listOf("products","services"))return null
 val rows=(options[kind] as? kotlinx.serialization.json.JsonArray)?.mapNotNull{it as? JsonObject}.orEmpty()
 val row=rows.firstOrNull{it.str("id")==id}?:return null
 val rate=row.str(if(kind=="products")"salePrice"else "sellingRate")
 if(rate.toBigDecimalOrNull()==null||row.str("taxRate").toBigDecimalOrNull()==null)return null
 val line=draft.lines[index].copy(lineType=if(kind=="products")"PRODUCT"else "SERVICE",sourceId=id,itemName=row.str("name"),description=row.str("description"),rate=rate,taxRate=row.str("taxRate"))
 val selected=editedQuotationLine(draft,index,line)
 val unitId=row.str("unitId")
 return selected.copy(lineMetadata=selected.lines.indices.map{n->
  if(n==index) kotlinx.serialization.json.buildJsonObject{selected.lineMetadata.getOrNull(n)?.forEach{(k,v)->if(k!="unitId")put(k,v)};if(unitId.isNotBlank())put("unitId",kotlinx.serialization.json.JsonPrimitive(unitId))}
  else selected.lineMetadata.getOrNull(n)?:JsonObject(emptyMap())
 })
}
