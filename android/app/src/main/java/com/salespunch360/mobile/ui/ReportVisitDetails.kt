package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun reportVisitTime(value:String?):String=if(value==null)"Not recorded"else runCatching{Instant.parse(value).atZone(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a",Locale.ENGLISH))+" IST"}.getOrDefault(value)
internal fun reportVisitCoordinates(lat:Double?,lng:Double?):String=if(lat==null||lng==null)"Not recorded"else String.format(Locale.ROOT,"%.5f, %.5f",lat,lng)
@Composable internal fun ReportVisitContactAndDetails(row:JsonObject){
 fun text(key:String)=row[key]?.jsonPrimitive?.contentOrNull?.takeIf{it.isNotBlank()}
 fun number(key:String)=row[key]?.jsonPrimitive?.doubleOrNull
 var expanded by remember(text("id")){mutableStateOf(false)}
 Text("Phone: ${text("contactPhone")?:"Not recorded"}")
 OutlinedButton({expanded=!expanded}){Text(if(expanded)"Hide details"else"Details")}
 if(expanded)Column(verticalArrangement=Arrangement.spacedBy(5.dp)){
  Text("Recorded contact: ${text("contactName")?:"Not recorded"}")
  Text("Visited by: ${(row["user"] as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull?:"Not recorded"}")
  Text("Visit type: ${text("visitType")?.replace('_',' ')?:"Not recorded"}")
  Text("Check in: ${reportVisitTime(text("checkedInAt"))}")
  Text("Check out: ${text("checkedOutAt")?.let(::reportVisitTime)?:"Not recorded — visit active"}")
  Text("Duration: ${number("durationMs")?.let{"${(it / 60000).toLong()} min"}?:"Not recorded"}")
  Text("Distance from saved reference: ${number("referenceDistanceMeters")?.let{"$it m"}?:"No saved reference"}")
  Text("Check-in address: ${text("checkInAddress")?:"Not recorded"}")
  Text("Check-in coordinates: ${reportVisitCoordinates(number("checkInLatitude"),number("checkInLongitude"))}")
  Text("Check-in accuracy: ${number("checkInAccuracyMeters")?.let{"$it m"}?:"Not recorded"}")
  Text("Checkout coordinates: ${reportVisitCoordinates(number("checkOutLatitude"),number("checkOutLongitude"))}")
  Text("Checkout accuracy: ${number("checkOutAccuracyMeters")?.let{"$it m"}?:"Not recorded"}")
  Text("Outcome: ${text("checkoutSentiment")?:"Not recorded"}")
  Text("Checkout remarks: ${text("checkoutRemarks")?:"Not recorded"}")
  Text("Visit notes: ${text("visitNotes")?:"Not recorded"}")
 }
}

internal fun deletableReportVisit(row:JsonObject):Pair<String,String>? {
 if(row["canDelete"]?.jsonPrimitive?.booleanOrNull!=true)return null
 val id=row["id"]?.jsonPrimitive?.contentOrNull?:return null
 val revision=row["updatedAt"]?.jsonPrimitive?.contentOrNull?:return null
 return id to revision
}
@Composable internal fun DeleteOwnVisitControl(row:JsonObject,pending:Boolean,onDelete:(String,String)->Unit){
 val visit=deletableReportVisit(row)?:return
 var confirm by remember(visit){mutableStateOf(false)}
 OutlinedButton(enabled=!pending,onClick={confirm=true}){Text(if(pending)"Deleting…" else "Delete")}
 if(confirm)androidx.compose.material3.AlertDialog(
  onDismissRequest={if(!pending)confirm=false},
  title={Text("Delete mistaken check-in?")},
  text={Text("This deletes the check-in and its photo permanently. Linked visits cannot be deleted. Attendance and travel remain unchanged.")},
  confirmButton={androidx.compose.material3.TextButton(enabled=!pending,onClick={confirm=false;onDelete(visit.first,visit.second)}){Text("Delete check-in")}},
  dismissButton={androidx.compose.material3.TextButton(enabled=!pending,onClick={confirm=false}){Text("Cancel")}}
 )
}
