package com.salespunch360.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import coil3.network.NetworkHeaders
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.salespunch360.mobile.BuildConfig
import com.salespunch360.mobile.LeadsViewModel
import com.salespunch360.mobile.ReportsState
import com.salespunch360.mobile.ReportsViewModel
import com.salespunch360.mobile.data.SecureSession
import kotlinx.serialization.json.*
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val adminReportZone=ZoneId.of("Asia/Kolkata")

@Composable
fun AdminCheckInReportScreen(state:ReportsState,vm:ReportsViewModel,onBack:(()->Unit)?=null){
 val context=LocalContext.current
 val token=remember{SecureSession(context).token()}
 val linkedLeadsVm:LeadsViewModel=viewModel(key="admin-report-checkin-linked-lead")
 val linkedLeadsState=linkedLeadsVm.state.collectAsStateWithLifecycle().value
 if(linkedLeadsState.detailLoading){LoadingScreen("Loading lead details…");return}
 if(linkedLeadsState.detail!=null){LeadsScreen(vm=linkedLeadsVm);return}
 val report=state.report
 val rows=report?.get("rows")?.jsonArray?:JsonArray(emptyList())
 val employees=report?.get("employees")?.jsonArray?:JsonArray(emptyList())
 val totalPages=report?.get("totalPages")?.jsonPrimitive?.intOrNull?:1

 LazyColumn(
  Modifier.fillMaxSize().padding(horizontal=16.dp),
  contentPadding=PaddingValues(vertical=14.dp),
  verticalArrangement=Arrangement.spacedBy(10.dp),
 ){
  item{
   onBack?.let{TextButton(it,contentPadding=PaddingValues(0.dp)){Text("← Reports")}}
   Text("Check-in Report",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   Text("Recent check-ins from all users are shown by default. Select an employee and date range for a specific report.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  }
  item{
   OutlinedCard(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,SalesLine)){
    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     AdminEmployeeDropdown(state.employeeId,employees,vm::setEmployee,true)
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      AdminDateButton("From Date",state.start,vm::setStart,Modifier.weight(1f))
      AdminDateButton("To Date",state.end,vm::setEnd,Modifier.weight(1f))
     }
     AdminChoiceRow("Status",state.status,listOf("ALL","ACTIVE","COMPLETED"),vm::setStatus)
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      Button({vm.load("check-ins")},enabled=!state.loading,modifier=Modifier.weight(1f)){Text("View Report")}
      OutlinedButton(vm::reset,enabled=!state.loading){Text("Reset")}
     }
    }
   }
  }
  item{ReportExportControls(state,vm)}
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}
  if(!state.loading&&state.message==null&&rows.isEmpty())item{ContentCard("No check-ins","No check-ins match the selected employee and date range.")}
  items(rows,key={it.jsonObject.adminText("id")?:it.toString()}){item->
   val row=item.jsonObject
   val id=row.adminText("id")
   val leadId=row.adminText("leadId")
   val employee=row.adminObjText("user","name")?:"Employee"
   val customer=row.adminObjText("customer","name")?:row.adminText("contactName")?:"Customer"
   val address=row.adminText("checkInAddress")?:adminCoords(row,"checkInLatitude","checkInLongitude")?:"Address unavailable"
   Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.cardColors(containerColor=Color.White),border=BorderStroke(1.dp,SalesLine)){
    Column{
     if(id!=null&&row["photo"] !is JsonNull&&row["photo"]!=null){
      val url=BuildConfig.API_BASE_URL.trimEnd('/')+"/api/visit-photos/$id/thumbnail"
      AsyncImage(
       model=ImageRequest.Builder(context).data(url).apply{token?.let{httpHeaders(NetworkHeaders.Builder().set("Authorization","Bearer $it").build())}}.crossfade(true).build(),
       contentDescription="Check-in photo",
       contentScale=ContentScale.Crop,
       modifier=Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(topStart=16.dp,topEnd=16.dp)),
      )
     }
     Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
      Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Top,horizontalArrangement=Arrangement.spacedBy(8.dp)){
       Text(customer,Modifier.weight(1f).then(if(leadId!=null)Modifier.clickable{linkedLeadsVm.open(leadId)}else Modifier),style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold,color=SalesInk)
       Surface(shape=RoundedCornerShape(50),color=Color(0xFFEEF3FF)){Text(if(row.adminText("checkedOutAt")==null)"Active" else "Completed",Modifier.padding(horizontal=9.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesBlue)}
      }
      Text(employee,fontWeight=FontWeight.SemiBold,color=SalesInk)
      row.adminText("checkedInAt")?.let{Text(adminReportDateTime(it),style=MaterialTheme.typography.bodySmall,fontWeight=FontWeight.SemiBold,color=SalesBlue)}
      Text(address,style=MaterialTheme.typography.bodySmall,color=SalesMuted)
      listOfNotNull(row.adminText("checkoutSentiment"),row.adminText("checkoutRemarks"),row.adminText("visitNotes")).takeIf{it.isNotEmpty()}?.let{Text(it.joinToString(" · "),style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
      if(leadId!=null)TextButton({linkedLeadsVm.open(leadId)},contentPadding=PaddingValues(0.dp)){Text("Open Lead Details")}
     }
    }
   }
  }
  if(totalPages>1)item{
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
    OutlinedButton({vm.load("check-ins",(state.page-1).coerceAtLeast(1))},enabled=state.page>1&&!state.loading){Text("Previous")}
    Text("Page ${state.page} of $totalPages",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
    Button({vm.load("check-ins",state.page+1)},enabled=state.page<totalPages&&!state.loading){Text("Next")}
   }
  }
 }
}

@Composable
fun AdminAttendanceReportScreen(state:ReportsState,vm:ReportsViewModel,onBack:(()->Unit)?=null){
 val report=state.report
 val employees=report?.get("employees")?.jsonArray?:JsonArray(emptyList())
 val rows=(report?.get("rows")?.jsonArray?:JsonArray(emptyList())).map{it.jsonObject}
 val selectedName=employees.firstOrNull{it.jsonObject.adminText("id")==state.employeeId}?.jsonObject?.adminText("name")
 val today=LocalDate.now(adminReportZone).toString()
 val grouped=remember(rows){rows.groupBy{adminAttendanceDay(it.adminText("startedAt"))}.filterKeys{it.isNotBlank()}.toSortedMap(compareByDescending{it})}
 val todayRows=grouped[today].orEmpty().sortedBy{adminEpoch(it.adminText("startedAt"))}
 val past=grouped.filterKeys{it!=today}
 val todayTotal=todayRows.sumOf(::adminAttendanceDuration)
 val expandedDays=remember{mutableStateMapOf<String,Boolean>()}

 LazyColumn(
  Modifier.fillMaxSize().padding(horizontal=16.dp),
  contentPadding=PaddingValues(vertical=14.dp),
  verticalArrangement=Arrangement.spacedBy(10.dp),
 ){
  item{
   onBack?.let{TextButton(it,contentPadding=PaddingValues(0.dp)){Text("← Reports")}}
   Text("Attendance Report",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   Text("Select an employee to view the same attendance report used for that Sales user.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  }
  item{
   OutlinedCard(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,SalesLine)){
    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     AdminEmployeeDropdown(state.employeeId,employees,vm::setEmployee,false)
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      AdminDateButton("From Date",state.start,vm::setStart,Modifier.weight(1f))
      AdminDateButton("To Date",state.end,vm::setEnd,Modifier.weight(1f))
     }
     AdminChoiceRow("Status",state.status,listOf("ALL","COMPLETED","OPEN"),vm::setStatus)
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      Button({vm.load("attendance")},enabled=state.employeeId!=null&&!state.loading,modifier=Modifier.weight(1f)){Text("View Report")}
      OutlinedButton(vm::reset,enabled=!state.loading){Text("Reset")}
     }
    }
   }
  }
  item{ReportExportControls(state,vm)}
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}
  if(!state.loading&&state.message==null&&state.employeeId==null)item{ContentCard("Select employee","Choose an employee above, select the date range, then tap View Report.")}
  if(!state.loading&&state.message==null&&state.employeeId!=null){
   item{Text(selectedName?:"Employee",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}
   item{
    Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(18.dp),colors=CardDefaults.cardColors(containerColor=Color(0xFFF7FAFF)),border=BorderStroke(1.dp,Color(0xFFDCE6F8))){
     Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
      Text("TODAY’S WORKHOURS",style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=SalesBlue)
      Text(adminDuration(todayTotal),style=MaterialTheme.typography.headlineLarge,fontWeight=FontWeight.Bold,color=SalesInk)
      Text("${todayRows.size} session${if(todayRows.size==1)"" else "s"} today",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
    }
   }
   item{Text("Today’s Attendance",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}
   if(todayRows.isEmpty())item{ContentCard("No attendance today","No attendance session is present for this employee today.")}
   else items(todayRows,key={it.adminText("id")?:it.toString()}){AdminAttendanceSessionCard(it)}
   item{Text("Past Attendance",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}
   if(past.isEmpty())item{ContentCard("No past attendance","No past attendance matches the selected date range.")}
   past.forEach{(day,dayRowsUnsorted)->
    val dayRows=dayRowsUnsorted.sortedBy{adminEpoch(it.adminText("startedAt"))}
    val expanded=expandedDays[day]?:false
    item(key="admin-day-$day"){
     Card(Modifier.fillMaxWidth().then(if(dayRows.size>1)Modifier.clickable{expandedDays[day]=!expanded}else Modifier),shape=RoundedCornerShape(16.dp),colors=CardDefaults.cardColors(containerColor=Color.White),border=BorderStroke(1.dp,SalesLine)){
      Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
       Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(adminDateLabel(day),fontWeight=FontWeight.Bold,color=SalesInk);Text("${dayRows.size} session${if(dayRows.size==1)"" else "s"}",color=SalesBlue)}
       AdminAttendanceDayStats(dayRows)
       if(dayRows.size==1||expanded){HorizontalDivider(color=SalesLine);dayRows.forEach{AdminAttendanceSessionCard(it,true)}}
      }
     }
    }
   }
  }
 }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdminDateButton(label:String,value:String,change:(String)->Unit,modifier:Modifier=Modifier){
 var open by remember{mutableStateOf(false)}
 if(open){
  val initial=value.takeIf{it.isNotBlank()}?.let{runCatching{LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()}.getOrNull()}
  val picker=rememberDatePickerState(initialSelectedDateMillis=initial)
  DatePickerDialog(onDismissRequest={open=false},confirmButton={TextButton({picker.selectedDateMillis?.let{change(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString())};open=false}){Text("Select")}},dismissButton={TextButton({open=false}){Text("Cancel")}}){DatePicker(state=picker)}
 }
 OutlinedButton({open=true},modifier){Column(Modifier.weight(1f),horizontalAlignment=Alignment.Start){Text(label,style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(if(value.isBlank())"Select" else adminDateLabel(value))};Icon(Icons.Default.CalendarMonth,null)}
}

@Composable
private fun AdminEmployeeDropdown(selected:String?,options:JsonArray,change:(String?)->Unit,allowAll:Boolean){
 var open by remember{mutableStateOf(false)}
 val selectedName=options.firstOrNull{it.jsonObject.adminText("id")==selected}?.jsonObject?.adminText("name")
 Box{
  OutlinedButton({open=true},Modifier.fillMaxWidth()){Column(Modifier.weight(1f),horizontalAlignment=Alignment.Start){Text("Employee",style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(selectedName?:if(allowAll)"All users" else "Select employee")};Icon(Icons.Default.ArrowDropDown,null)}
  DropdownMenu(open,{open=false}){
   if(allowAll)DropdownMenuItem({Text("All users")},{change(null);open=false})
   options.forEach{item->val o=item.jsonObject;DropdownMenuItem({Text(o.adminText("name")?:"Employee")},{change(o.adminText("id"));open=false})}
  }
 }
}

@Composable
private fun AdminChoiceRow(label:String,current:String,options:List<String>,change:(String)->Unit){Column{Text(label,style=MaterialTheme.typography.labelMedium);Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){options.forEach{FilterChip(current==it,{change(it)},{Text(it.lowercase().replaceFirstChar(Char::uppercase))})}}}}

@Composable
private fun AdminAttendanceSessionCard(row:JsonObject,compact:Boolean=false){
 val start=row.adminText("startedAt"),end=row.adminText("endedAt"),points=row["locationPoints"]?.jsonArray?.size?:0,distance=row["routeDistanceMeters"]?.jsonPrimitive?.doubleOrNull?:0.0
 val content:@Composable ()->Unit={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
  Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
   Column(Modifier.weight(1f)){Text("START TIME",style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(start?.let(::adminTime)?:"—",fontWeight=FontWeight.Bold,color=SalesInk)}
   Surface(shape=RoundedCornerShape(50),color=Color(0xFFEEF3FF)){Text(adminDuration(adminAttendanceDuration(row)),Modifier.padding(horizontal=8.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesBlue)}
   Column(Modifier.weight(1f),horizontalAlignment=Alignment.End){Text("END TIME",style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(end?.let(::adminTime)?:"Now",fontWeight=FontWeight.Bold,color=if(end==null)Color(0xFFB54708) else SalesInk)}
  }
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("GPS: $points points",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text("Travel: ${"%.2f".format(distance/1000)} km",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
 }}
 if(compact)content() else OutlinedCard(Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp),border=BorderStroke(1.dp,SalesLine)){Box(Modifier.padding(13.dp)){content()}}
}

@Composable
private fun AdminAttendanceDayStats(rows:List<JsonObject>){
 val first=rows.minByOrNull{adminEpoch(it.adminText("startedAt"))},hasOpen=rows.any{it.adminText("endedAt")==null},lastEnd=if(hasOpen)null else rows.mapNotNull{it.adminText("endedAt")}.maxByOrNull(::adminEpoch),total=rows.sumOf(::adminAttendanceDuration),points=rows.sumOf{it["locationPoints"]?.jsonArray?.size?:0},distance=rows.sumOf{it["routeDistanceMeters"]?.jsonPrimitive?.doubleOrNull?:0.0}
 Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){AdminStat("START",first?.adminText("startedAt")?.let(::adminTime)?:"—",Modifier.weight(1f));AdminStat("END",lastEnd?.let(::adminTime)?:if(hasOpen)"Now" else "—",Modifier.weight(1f));AdminStat("TOTAL",adminDuration(total),Modifier.weight(1f))}
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){AdminStat("GPS","$points",Modifier.weight(1f));AdminStat("TRAVEL","${"%.2f".format(distance/1000)} km",Modifier.weight(1f));AdminStat("SESSIONS","${rows.size}",Modifier.weight(1f))}
 }
}

@Composable
private fun AdminStat(label:String,value:String,modifier:Modifier){Column(modifier){Text(label,style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(value,fontWeight=FontWeight.Bold,color=SalesInk)}}
private fun JsonObject.adminText(key:String)=this[key]?.jsonPrimitive?.contentOrNull
private fun JsonObject.adminObjText(key:String,child:String)=((this[key] as? JsonObject)?.get(child) as? JsonPrimitive)?.contentOrNull
private fun adminCoords(o:JsonObject,a:String,b:String):String?{val lat=o[a]?.jsonPrimitive?.doubleOrNull,lng=o[b]?.jsonPrimitive?.doubleOrNull;return if(lat!=null&&lng!=null)"%.5f, %.5f".format(lat,lng)else null}
private fun adminEpoch(value:String?):Long=value?.let{runCatching{OffsetDateTime.parse(it).toInstant().toEpochMilli()}.getOrNull()}?:0L
private fun adminAttendanceDay(value:String?):String=value?.let{runCatching{OffsetDateTime.parse(it).atZoneSameInstant(adminReportZone).toLocalDate().toString()}.getOrNull()}.orEmpty()
private fun adminAttendanceDuration(row:JsonObject):Long{val start=adminEpoch(row.adminText("startedAt"));if(start==0L)return 0L;val end=row.adminText("endedAt")?.let(::adminEpoch)?.takeIf{it>0L}?:System.currentTimeMillis();return(end-start).coerceAtLeast(0L)}
private fun adminTime(value:String)=runCatching{OffsetDateTime.parse(value).atZoneSameInstant(adminReportZone).format(DateTimeFormatter.ofPattern("h:mm a"))}.getOrDefault(value)
private fun adminReportDateTime(value:String)=runCatching{OffsetDateTime.parse(value).atZoneSameInstant(adminReportZone).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.getOrDefault(value)
private fun adminDateLabel(value:String)=runCatching{LocalDate.parse(value).format(DateTimeFormatter.ofPattern("d MMM yyyy"))}.getOrDefault(value)
private fun adminDuration(ms:Long)="${ms/3_600_000}h ${(ms%3_600_000)/60_000}m"
