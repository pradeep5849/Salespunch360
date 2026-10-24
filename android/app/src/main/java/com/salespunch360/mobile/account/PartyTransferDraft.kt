package com.salespunch360.mobile.account
import java.math.BigDecimal
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.json.*

fun partyTransferCommission(received:String,paid:String):String{
 val valid=Regex("^[0-9]{1,16}(?:\\.[0-9]{1,2})?$")
 require(valid.matches(received)&&valid.matches(paid)){"Use amounts with up to two decimal places."}
 val incoming=BigDecimal(received);val outgoing=BigDecimal(paid)
 require(incoming>BigDecimal.ZERO&&outgoing>=BigDecimal.ZERO&&outgoing<=incoming){"Paid amount cannot exceed the positive received amount."}
 return incoming.subtract(outgoing).setScale(2).toPlainString()
}
fun partyTransferDocument(key:String,branch:String,account:String,date:String,receivedParty:String,paidParty:String,received:String,paid:String,notes:String):JsonObject{
 UUID.fromString(key);UUID.fromString(branch);UUID.fromString(account);require(LocalDate.parse(date).toString()==date);partyTransferCommission(received,paid);require(notes.length<=5000)
 fun party(value:String):JsonObject{val parts=value.split(":");require(parts.size==2&&parts[0] in listOf("CUSTOMER","VENDOR"));UUID.fromString(parts[1]);return buildJsonObject{put("kind",parts[0]);put("id",parts[1])}}
 require(receivedParty!=paidParty){"Select two different parties."}
 return buildJsonObject{put("requestKey",key);put("branchId",branch);put("moneyAccountId",account);put("transactionDate",date);put("receivedParty",party(receivedParty));put("paidParty",party(paidParty));put("receivedAmount",received);put("paidAmount",paid);put("notes",notes)}
}
