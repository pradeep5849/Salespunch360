package com.salespunch360.mobile.account

import kotlinx.serialization.json.JsonObject

fun purchaseInitialTaxMode(settings:JsonObject)=if(settings.str("defaultTaxMode")=="INCLUSIVE")"INCLUSIVE"else"EXCLUSIVE"

/** Only an explicit item selection replaces the rate; historical source-line selection is separate. */
fun purchaseMasterLine(line:SalesLineDraft,master:SalesOption,taxMode:String):SalesLineDraft {
    val price=itemMasterPrice(master,taxMode,purchase=true,quantity=line.quantity)
    return line.copy(sourceId=master.id,rate=price.rate,taxRate=master.taxRate.orEmpty(),batchId="",serialNumberId="",sourceCommercialLineId="",purchaseAllocations=emptyList())
}
