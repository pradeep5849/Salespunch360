package com.salespunch360.mobile.account

import kotlinx.serialization.json.JsonObject

fun purchaseInitialTaxMode(settings:JsonObject)=if(settings.str("defaultTaxMode")=="INCLUSIVE")"INCLUSIVE"else"EXCLUSIVE"

/** Only an explicit item selection replaces the rate; historical source-line selection is separate. */
fun purchaseMasterLine(line:SalesLineDraft,master:SalesOption,taxMode:String):SalesLineDraft {
    val price=itemMasterPrice(master,taxMode,purchase=true,quantity=line.quantity)
    return line.copy(unitSelection="PRIMARY",secondaryUnitsPerBase=master.secondaryUnitsPerBase,originalLineId="",copiedFromSaleLineId="",sourceId=master.id,rate=price.rate,taxRate=master.taxRate.orEmpty(),batchId="",serialNumberId="",sourceCommercialLineId="",purchaseAllocations=emptyList())
}


fun purchaseUnitLine(line:SalesLineDraft,master:SalesOption,taxMode:String,selection:String,unit:SalesOption?=null):SalesLineDraft{
 require(selection!="SECONDARY"||master.secondaryUnitId.isNotBlank()){"Unit conversion unavailable"}
 val price=itemMasterPriceForUnit(master,taxMode,purchase=true,quantity=line.quantity,selection=selection)
 return line.copy(unitSelection=selection,secondaryUnitsPerBase=master.secondaryUnitsPerBase,rate=price.rate,unitName=unit?.name.orEmpty(),unitSymbol=unit?.symbol.orEmpty())
}
