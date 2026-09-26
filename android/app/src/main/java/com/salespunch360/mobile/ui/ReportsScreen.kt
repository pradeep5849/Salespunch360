@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.salespunch360.mobile.ui

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.salespunch360.mobile.ReportsViewModel
import com.salespunch360.mobile.data.MobileRole
import kotlinx.serialization.json.*
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun reportTypes(role:MobileRole)=when(role){
 MobileRole.SALES->listOf(
  "check-ins" to "Check-in Report",
  "advanced-check-ins" to "Advanced Check-in",
  "attendance" to "My Attendance",
  "gps" to "My Travel / Distance",
  "leads" to "Lead Report",
  "targets" to "My Performance",
 )
 MobileRole.MANAGER->listOf(
  "check-ins" to "Check-in Report",
  "advanced-check-ins" to "Advanced Check-in",
  "attendance" to "Attendance Report",
  "gps" to "GPS Report",
  "geofence" to "Geofence Report",
  "leads" to "Lead Report",
  "targets" to "Target Analysis",
 )
 else->listOf(
  "check-ins" to "Check-in Report",
  "advanced-check-ins" to "Advanced Check-in",
  "attendance" to "Attendance Report",
  "gps" to "GPS Report",
  "geofence" to "Geofence Report",
  "leads" to "Lead Report",
  "targets" to "Target Analysis",
 )
}

private fun reportActorRole(report:JsonObject?):MobileRole?=when(report?.get("actor")?.jsonObject?.get("salesRole")?.jsonPrimitive?.contentOrNull){
 "PRIMARY_ADMIN"->MobileRole.PRIMARY_ADMIN
 "ADMIN"->MobileRole.ADMIN
 "MANAGER"->MobileRole.MANAGER
 "SALES"->MobileRole.SALES
 else->null
}

@Composable
fun ReportsScreen(
 initialType:String?=null,
 showMenu:Boolean=true,
 role:MobileRole=MobileRole.SALES,
 vm:ReportsViewModel=viewModel(),
){
 val state=vm.state.collectAsStateWithLifecycle().value
 var selected by remember(initialType,showMenu){mutableStateOf(if(showMenu)initialType else initialType?:state.type)}
 val activeType=if(showMenu)selected else selected?:state.type
 val effectiveRole=reportActorRole(state.report)?:role
 val types=reportTypes(effectiveRole)
 var gpsIncludeEvents by remember(activeType){mutableStateOf(true)}
 var gpsShowGeofence by remember(activeType){mutableStateOf(false)}
 var gpsRawData by remember(activeType){mutableStateOf(false)}
 var eventLimit by remember(activeType){mutableIntStateOf(20)}
 var rawLimit by remember(activeType){mutableIntStateOf(40)}
 var deviceDetails by remember{mutableStateOf<JsonObject?>(null)}

 LaunchedEffect(showMenu,initialType){if(showMenu&&initialType==null)vm.load("attendance")}
 LaunchedEffect(activeType){activeType?.let{vm.load(it)}}

 if(showMenu&&selected==null){
  if(state.report==null){Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator()};return}
  LazyColumn(
   Modifier.fillMaxSize().padding(horizontal=16.dp),
   contentPadding=PaddingValues(vertical=12.dp),
   verticalArrangement=Arrangement.spacedBy(8.dp),
  ){
   item{
    Text("Reports",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
    Text("Select a report. It opens on its own page.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
   }
   items(types){(id,label)->OutlinedButton({selected=id},Modifier.fillMaxWidth()){Text(label,Modifier.fillMaxWidth())}}
  }
  return
 }

 if(effectiveRole!=MobileRole.SALES&&activeType=="check-ins"){
  AdminCheckInReportScreen(state,vm,if(showMenu){{selected=null}}else null)
  return
 }
 if(effectiveRole!=MobileRole.SALES&&activeType=="attendance"){
  AdminAttendanceReportScreen(state,vm,if(showMenu){{selected=null}}else null)
  return
 }
 if(effectiveRole!=MobileRole.SALES&&activeType=="targets"){
  AdminTargetAnalysisScreen(state,vm,if(showMenu){{selected=null}}else null)
  return
 }

 val report=state.report
 val rows=report?.get("rows")?.jsonArray?:report?.get("targets")?.jsonArray?:JsonArray(emptyList())
 val title=types.firstOrNull{it.first==(activeType?:state.type)}?.second?:"Report"

 LazyColumn(
  Modifier.fillMaxSize().padding(horizontal=16.dp),
  contentPadding=PaddingValues(vertical=12.dp),
  verticalArrangement=Arrangement.spacedBy(10.dp),
 ){
  item{
   if(showMenu)TextButton({selected=null},contentPadding=PaddingValues(0.dp)){Text("← Reports")}
   Text(title,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
  }
  item{ReportFilters(state,vm,effectiveRole)}
  if(state.type=="gps"){
   item{
    GpsOptions(
     includeEvents=gpsIncludeEvents,
     setIncludeEvents={gpsIncludeEvents=it},
     showGeofence=gpsShowGeofence,
     setShowGeofence={gpsShowGeofence=it},
     rawData=gpsRawData,
     toggleRawData={gpsRawData=!gpsRawData},
     sync={vm.load()},
     syncing=state.loading,
    )
   }
  }
  item{ReportExportControls(state,vm)}
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}

  report?.let{r->
   if(state.type=="gps"){
    item{GpsSummary(r)}
    item{GpsRouteMap(r,gpsIncludeEvents,gpsShowGeofence)}

    if(gpsRawData){
     val points=r["points"]?.jsonArray?:JsonArray(emptyList())
     item{
      Text("Raw GPS Data",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
      Text("Accepted device points for the selected day while attendance was ON.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
     if(points.isEmpty())item{Text("No accepted GPS points for this day.",color=SalesMuted)}
     else items(points.take(rawLimit),key={it.jsonObject.text("id")?:it.toString()}){RawGpsPointCard(it.jsonObject)}
     if(points.size>rawLimit)item{OutlinedButton({rawLimit+=40},Modifier.fillMaxWidth()){Text("Load More Raw Data")}}
    }

    if(gpsIncludeEvents){
     val events=r["events"]?.jsonArray?:JsonArray(emptyList())
     item{
      Text("Daily Timeline",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
      Text("Attendance and customer visits are shown once in time order.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
     if(events.isEmpty())item{Text("No timeline events are available for this day.",color=SalesMuted)}
     else items(events.take(eventLimit),key={it.jsonObject.text("id")?:it.toString()}){EventCard(it.jsonObject){deviceDetails=it}}
     if(events.size>eventLimit)item{OutlinedButton({eventLimit+=20},Modifier.fillMaxWidth()){Text("Load More")}}
    }

    item{GpsDisclaimer()}
   }else{
    item{SummaryCards(r["summary"]?.jsonObject)}
    if(rows.isEmpty())item{ContentCard("No report records","No records match the selected filters.")}
    else items(rows.size){ReportRow(rows[it].jsonObject)}
    val pages=r["totalPages"]?.jsonPrimitive?.intOrNull?:1
    if(pages>1)item{
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
      OutlinedButton({vm.load(page=(state.page-1).coerceAtLeast(1))},enabled=state.page>1){Text("Previous")}
      Text("Page ${state.page} of $pages")
      Button({vm.load(page=state.page+1)},enabled=state.page<pages){Text("Next")}
     }
    }
   }
  }
 }

 deviceDetails?.let{row->
  AlertDialog(
   onDismissRequest={deviceDetails=null},
   title={Text("Device / GPS Details")},
   text={
    Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
     Text(prettyLabel(row.text("type")?:"GPS event"),fontWeight=FontWeight.Bold)
     row.text("at")?.let{Text("Time: ${reportTime(it)}")}
     coords(row,"latitude","longitude")?.let{Text("Coordinates: $it")}
     row.text("detail")?.let{Text(it)}
     Text("Location coordinates are reported by the employee device and can vary with GPS conditions.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
    }
   },
   confirmButton={TextButton({deviceDetails=null}){Text("Close")}},
  )
 }
}

@Composable
private fun SummaryCards(summary:JsonObject?){
 if(summary==null)return
 FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
  summary.entries.filterNot{it.key in setOf("firstVisits","repeatVisits")&&it.value.jsonPrimitive.intOrNull==0}.forEach{(k,v)->StatusChip("${prettyLabel(k)} ${value(v)}")}
 }
}

@Composable
private fun GpsSummary(r:JsonObject){
 val points=r["points"]?.jsonArray?.size?:0
 val metres=r["routeDistanceMeters"]?.jsonPrimitive?.doubleOrNull?:0.0
 val visits=r["visitCount"]?.jsonPrimitive?.intOrNull?:0
 val employee=r["employee"]?.jsonObject?.text("name")
 val last=r.text("lastSpottedAt")
 ContentCard(employee?:"Daily GPS Report","Selected employee · selected day"){
  Text("Total Distance Covered: ${"%.2f".format(metres/1000)} KM",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
  FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
   StatusChip("Accepted GPS points $points")
   StatusChip("Customer visits $visits")
  }
  Text("Last spotted: ${last?.let(::reportTime)?:"No GPS point recorded"}",fontWeight=FontWeight.SemiBold)
  Text("Distance is the sum of accepted GPS movement only while attendance is ON. Movement between attendance periods is not counted or connected.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
 }
}

@Composable
private fun GpsRouteMap(r:JsonObject,includeEvents:Boolean,showGeofence:Boolean){
 val segments=(r["segments"]?.jsonArray?:JsonArray(emptyList())).map{segment->
  segment.jsonArray.mapNotNull{item->
   val o=item.jsonObject
   val lat=o["latitude"]?.jsonPrimitive?.doubleOrNull
   val lng=o["longitude"]?.jsonPrimitive?.doubleOrNull
   if(lat!=null&&lng!=null)NativeMapPoint(lat,lng)else null
  }
 }
 val eventMarkers=if(includeEvents)(r["markers"]?.jsonArray?:JsonArray(emptyList())).mapNotNull{item->
  val o=item.jsonObject
  val lat=o["latitude"]?.jsonPrimitive?.doubleOrNull
  val lng=o["longitude"]?.jsonPrimitive?.doubleOrNull
  if(lat!=null&&lng!=null)NativeMapPoint(lat,lng,o.text("label"))else null
 }else emptyList()
 val geofence=r["geofence"]?.takeUnless{it is JsonNull}?.jsonObject
 val geofenceMarker=if(showGeofence&&geofence!=null){
  val lat=geofence["latitude"]?.jsonPrimitive?.doubleOrNull
  val lng=geofence["longitude"]?.jsonPrimitive?.doubleOrNull
  val radius=geofence["radiusMeters"]?.jsonPrimitive?.intOrNull
  if(lat!=null&&lng!=null)listOf(NativeMapPoint(lat,lng,"Attendance geofence${radius?.let{" · ${it}m radius"}.orEmpty()}"))else emptyList()
 }else emptyList()
 val markers=(eventMarkers+geofenceMarker).distinctBy{Triple(it.latitude,it.longitude,it.label)}
 if(segments.flatten().isNotEmpty()||markers.isNotEmpty()){
  NativeMap(segments,markers,modifier=Modifier.fillMaxWidth().height(320.dp))
  if(showGeofence&&geofence!=null){
   Text("Geofence reference is shown on the map with its configured radius.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  }
 }else{
  Text("No stored coordinates are available for this day.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
 }
}

@Composable
private fun GpsOptions(
 includeEvents:Boolean,
 setIncludeEvents:(Boolean)->Unit,
 showGeofence:Boolean,
 setShowGeofence:(Boolean)->Unit,
 rawData:Boolean,
 toggleRawData:()->Unit,
 sync:()->Unit,
 syncing:Boolean,
){
 OutlinedCard(Modifier.fillMaxWidth()){
  Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
    Checkbox(includeEvents,setIncludeEvents)
    Text("Add Daily Check-ins / Attendance in the Report",Modifier.weight(1f))
   }
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
    Checkbox(showGeofence,setShowGeofence)
    Text("Show Geofence",Modifier.weight(1f))
   }
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    OutlinedButton(toggleRawData,Modifier.weight(1f)){Text(if(rawData)"Hide Raw Data" else "Raw Data")}
    OutlinedButton(sync,enabled=!syncing,modifier=Modifier.weight(1f)){Text(if(syncing)"Syncing…" else "Sync Data")}
   }
  }
 }
}

@Composable
private fun EventCard(row:JsonObject,deviceDetails:(JsonObject)->Unit){
 val title=when(row.text("type")){"VISIT"->"Customer Visit";else->prettyLabel(row.text("type")?:"Event")}
 ContentCard(title,listOfNotNull(row.text("at")?.let(::reportTime),row.text("customer"),row.text("detail"),coords(row,"latitude","longitude")).joinToString(" · ")){
  if(row["latitude"]?.jsonPrimitive?.doubleOrNull!=null&&row["longitude"]?.jsonPrimitive?.doubleOrNull!=null){
   TextButton({deviceDetails(row)},contentPadding=PaddingValues(0.dp)){Text("Device Details")}
  }
 }
}

@Composable
private fun RawGpsPointCard(row:JsonObject){
 val sequence=row["sequenceNumber"]?.jsonPrimitive?.intOrNull
 val accuracy=row["accuracyMeters"]?.jsonPrimitive?.doubleOrNull
 OutlinedCard(Modifier.fillMaxWidth()){
  Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
   Text("GPS Point${sequence?.let{" #$it"}.orEmpty()}",fontWeight=FontWeight.Bold)
   row.text("capturedAt")?.let{Text(reportTime(it),style=MaterialTheme.typography.bodySmall)}
   coords(row,"latitude","longitude")?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
   accuracy?.let{Text("Accuracy: ${"%.1f".format(it)} m",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
  }
 }
}

@Composable
private fun GpsDisclaimer(){
 ContentCard("GPS Disclaimer","Route information is for operational reference"){
  Text(
   "GPS coordinates come from the employee device and may be affected by buildings, weather, device settings, signal quality and Android background restrictions. The displayed path and distance use accepted points captured only while attendance is ON. They should be treated as operational information, not as independent proof of a person's presence at an exact location.",
   style=MaterialTheme.typography.bodySmall,
   color=SalesMuted,
  )
 }
}

@Composable
private fun ReportRow(row:JsonObject){
 val title=row.objText("user","name")?:row.objText("assignedUser","name")?:row.objText("employee","name")?:row.objText("customer","name")?:row.text("title")?:"Report record"
 val hidden=setOf("id","companyId","branchId","userId","customerId","assignedUserId","user","customer","assignedUser")
 OutlinedCard(Modifier.fillMaxWidth()){
  Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
   Text(title,fontWeight=FontWeight.Bold)
   row.entries.filter{it.key !in hidden&&!it.value.isNullish()}.forEach{(k,v)->Text("${prettyLabel(k)}: ${value(v)}",style=MaterialTheme.typography.bodySmall)}
  }
 }
}

@Composable
private fun ReportFilters(state:com.salespunch360.mobile.ReportsState,vm:ReportsViewModel,role:MobileRole){
 val employees=state.report?.get("employees")?.jsonArray?:JsonArray(emptyList())
 val customers=state.report?.get("customers")?.jsonArray?:JsonArray(emptyList())
 if(state.type=="gps"){
  Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
   DateField("Date",state.start,vm::setStart,Modifier.fillMaxWidth())
   if(role!=MobileRole.SALES)EmployeeDropdown(state.employeeId,employees,vm::setEmployee)
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    Button({vm.load()},Modifier.weight(1f)){Text("View Report")}
    OutlinedButton(vm::reset){Text("Reset")}
   }
  }
  return
 }
 Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
   DateField("Start",state.start,vm::setStart,Modifier.weight(1f))
   DateField("End",state.end,vm::setEnd,Modifier.weight(1f))
  }
  CycleFilter("Employee",state.employeeId,employees,vm::setEmployee)
  if(state.type.contains("check-ins"))CycleFilter("Customer",state.customerId,customers,vm::setCustomer)
  if(state.type.contains("check-ins")){
   ChoiceRow("Status",state.status,listOf("ALL","ACTIVE","COMPLETED"),vm::setStatus)
   ChoiceRow("Sentiment",state.sentiment,listOf("ALL","POSITIVE","NEUTRAL","NEGATIVE"),vm::setSentiment)
  }
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
   Button({vm.load()}){Text("Apply")}
   OutlinedButton(vm::reset){Text("Reset")}
  }
 }
}

@Composable
private fun EmployeeDropdown(selected:String?,options:JsonArray,change:(String?)->Unit){
 var open by remember{mutableStateOf(false)}
 val selectedName=options.firstOrNull{it.jsonObject.text("id")==selected}?.jsonObject?.text("name")
 Box{
  OutlinedButton({open=true},Modifier.fillMaxWidth()){
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
    Column(Modifier.weight(1f)){
     Text("Employee",style=MaterialTheme.typography.labelSmall,color=SalesMuted)
     Text(selectedName?:"Select employee")
    }
    Icon(Icons.Default.ArrowDropDown,"Open employee list")
   }
  }
  DropdownMenu(expanded=open,onDismissRequest={open=false}){
   options.forEach{item->
    val o=item.jsonObject
    DropdownMenuItem(
     text={Text(o.text("name")?:"Employee")},
     onClick={change(o.text("id"));open=false},
    )
   }
  }
 }
}

@Composable
private fun CycleFilter(label:String,selected:String?,options:JsonArray,change:(String?)->Unit){
 if(options.isEmpty())return
 val name=options.firstOrNull{it.jsonObject.text("id")==selected}?.jsonObject?.text("name")?:"All permitted ${label.lowercase()}s"
 OutlinedButton({val i=options.indexOfFirst{it.jsonObject.text("id")==selected};change(if(i+1>=options.size)null else options[i+1].jsonObject.text("id"))},Modifier.fillMaxWidth()){Text("$label: $name")}
}

@Composable
private fun ChoiceRow(label:String,current:String,options:List<String>,change:(String)->Unit){
 Column{
  Text(label,style=MaterialTheme.typography.labelMedium)
  FlowRow(horizontalArrangement=Arrangement.spacedBy(4.dp)){options.forEach{FilterChip(current==it,{change(it)},{Text(prettyLabel(it))})}}
 }
}

private fun JsonObject.text(key:String)=this[key]?.jsonPrimitive?.contentOrNull
private fun JsonObject.objText(key:String,child:String)=this[key]?.jsonObject?.get(child)?.jsonPrimitive?.contentOrNull
private fun coords(o:JsonObject,a:String,b:String)=if(o[a]?.jsonPrimitive?.doubleOrNull!=null&&o[b]?.jsonPrimitive?.doubleOrNull!=null)"${o[a]?.jsonPrimitive?.content}, ${o[b]?.jsonPrimitive?.content}" else null
private fun JsonElement.isNullish()=this is JsonNull||(this is JsonPrimitive&&contentOrNull.isNullOrBlank())
private fun value(v:JsonElement):String=when(v){is JsonPrimitive->v.content;is JsonObject->v.entries.joinToString{(k,x)->"${prettyLabel(k)} ${value(x)}"};is JsonArray->"${v.size} item${if(v.size==1)"" else "s"}";else->"—"}
private fun prettyLabel(s:String)=s.replace('_',' ').replace(Regex("([a-z])([A-Z])"),"$1 $2").lowercase().replaceFirstChar{it.uppercase()}
private fun reportTime(value:String)=runCatching{
 OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))
}.getOrDefault(value)

@Composable
fun ReportExportControls(state:com.salespunch360.mobile.ReportsState,vm:ReportsViewModel){
 val supported=state.type in setOf("attendance","check-ins","advanced-check-ins","leads","gps","geofence","targets")
 if(!supported)return
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var cached by remember(state.type){mutableStateOf<java.io.File?>(null)}
 val save=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")){uri->
  val file=cached
  if(uri!=null&&file!=null)scope.launch(Dispatchers.IO){context.contentResolver.openOutputStream(uri)?.use{out->file.inputStream().use{it.copyTo(out)}}}
 }
 LaunchedEffect(state.export){
  val bytes=state.export?:return@LaunchedEffect
  cached=withContext(Dispatchers.IO){java.io.File(context.cacheDir,"${state.type}-${System.currentTimeMillis()}.xlsx").apply{writeBytes(bytes)}}
  vm.consumeExport()
 }
 Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
  OutlinedButton(vm::exportExcel,enabled=!state.exporting,modifier=Modifier.fillMaxWidth()){Text(if(state.exporting)"Preparing Excel…" else "Export Excel")}
  cached?.let{file->
   Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
    val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
    OutlinedButton({runCatching{context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))}}){Text("Open")}
    OutlinedButton({context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share report"))}){Text("Share")}
    OutlinedButton({save.launch("${state.type}.xlsx")}){Text("Save")}
   }
  }
 }
}
