package com.salespunch360.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
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

private val salesReportZone=ZoneId.of("Asia/Kolkata")

@Composable
fun SalesReportScreen(type:String,vm:ReportsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 LaunchedEffect(type){
  vm.setStart("")
  vm.setEnd("")
  vm.setEmployee(null)
  vm.setCustomer(null)
  vm.setStatus("ALL")
  vm.setSentiment("ALL")
  vm.load(type)
 }
 when(type){
  "check-ins"->SalesCheckInReport(state,vm)
  "attendance"->SalesAttendanceReport(state)
  else->ReportsScreen(initialType=type,showMenu=false)
 }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SalesCheckInReport(state:ReportsState,vm:ReportsViewModel){
 val context=LocalContext.current
 val token=remember{SecureSession(context).token()}
 val linkedLeadsVm:LeadsViewModel=viewModel(key="report-checkin-linked-lead")
 val linkedLeadsState=linkedLeadsVm.state.collectAsStateWithLifecycle().value
 if(linkedLeadsState.detailLoading){LoadingScreen("Loading lead details…");return}
 if(linkedLeadsState.detail!=null){LeadsScreen(vm=linkedLeadsVm);return}
 val rows=state.report?.get("rows")?.jsonArray?:JsonArray(emptyList())
 val totalPages=state.report?.get("totalPages")?.jsonPrimitive?.intOrNull?:1
 var searchDate by rememberSaveable{mutableStateOf("")}
 var filtered by rememberSaveable{mutableStateOf(false)}
 var pickerOpen by remember{mutableStateOf(false)}

 if(pickerOpen){
  val pickerState=rememberDatePickerState(initialSelectedDateMillis=searchDate.takeIf{it.isNotBlank()}?.let{runCatching{LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()}.getOrNull()})
  DatePickerDialog(
   onDismissRequest={pickerOpen=false},
   confirmButton={TextButton({
    pickerState.selectedDateMillis?.let{millis->searchDate=Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()}
    pickerOpen=false
   }){Text("Select")}},
   dismissButton={TextButton({pickerOpen=false}){Text("Cancel")}},
  ){DatePicker(state=pickerState)}
 }

 LazyColumn(
  Modifier.fillMaxSize().padding(horizontal=16.dp),
  contentPadding=PaddingValues(vertical=16.dp),
  verticalArrangement=Arrangement.spacedBy(12.dp),
 ){
  item{
   Text("Check-in Report",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   Text("All your check-ins, latest first. Search a particular day below.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  }
  item{
   Card(
    Modifier.fillMaxWidth(),
    shape=RoundedCornerShape(16.dp),
    colors=CardDefaults.cardColors(containerColor=Color.White),
    border=BorderStroke(1.dp,SalesLine),
   ){
    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
     Text("Search check-ins by date",fontWeight=FontWeight.Bold,color=SalesInk)
     OutlinedButton({pickerOpen=true},Modifier.fillMaxWidth()){
      Icon(Icons.Default.CalendarMonth,null)
      Spacer(Modifier.width(8.dp))
      Text(if(searchDate.isBlank())"Select date" else salesReportDateLabel(searchDate))
     }
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      Button(
       onClick={vm.setStart(searchDate);vm.setEnd(searchDate);filtered=true;vm.load("check-ins")},
       enabled=searchDate.isNotBlank()&&!state.loading,
       modifier=Modifier.weight(1f),
      ){Text("Search")}
      OutlinedButton(
       onClick={searchDate="";filtered=false;vm.setStart("");vm.setEnd("");vm.load("check-ins")},
       enabled=!state.loading,
       modifier=Modifier.weight(1f),
      ){Text("Clear")}
     }
    }
   }
  }
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}
  if(!state.loading&&state.message==null&&rows.isEmpty())item{ContentCard("No check-ins",if(filtered)"No check-ins were found for this date." else "No check-ins are available yet.")}
  items(rows,key={it.jsonObject.salesText("id")?:it.toString()}){item->
   val row=item.jsonObject
   val id=row.salesText("id")
   val leadId=row.salesText("leadId")
   val customer=row.salesObjText("customer","name")?:row.salesText("contactName")?:"Field prospect"
   val address=row.salesText("checkInAddress")?:run{
    val lat=row["checkInLatitude"]?.jsonPrimitive?.doubleOrNull
    val lng=row["checkInLongitude"]?.jsonPrimitive?.doubleOrNull
    if(lat!=null&&lng!=null)"%.5f, %.5f".format(lat,lng) else "Address unavailable"
   }
   Card(
    Modifier.fillMaxWidth(),
    shape=RoundedCornerShape(16.dp),
    colors=CardDefaults.cardColors(containerColor=Color.White),
    border=BorderStroke(1.dp,SalesLine),
   ){
    Column(verticalArrangement=Arrangement.spacedBy(0.dp)){
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
       Surface(shape=RoundedCornerShape(50),color=Color(0xFFEEF3FF)){
        Text(if(row.salesText("checkedOutAt")==null)"Active" else "Completed",Modifier.padding(horizontal=9.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesBlue)
       }
      }
      row.salesText("checkedInAt")?.let{Text(salesReportDateTime(it),style=MaterialTheme.typography.bodySmall,fontWeight=FontWeight.SemiBold,color=SalesBlue)}
      Text(address,style=MaterialTheme.typography.bodySmall,color=SalesMuted)
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
private fun SalesAttendanceReport(state:ReportsState){
 val rows=(state.report?.get("rows")?.jsonArray?:JsonArray(emptyList())).map{it.jsonObject}
 val today=LocalDate.now(salesReportZone).toString()
 val grouped=remember(rows){rows.groupBy{salesAttendanceDay(it.salesText("startedAt"))}.filterKeys{it.isNotBlank()}.toSortedMap(compareByDescending{it})}
 val todayRows=grouped[today].orEmpty().sortedBy{salesEpoch(it.salesText("startedAt"))}
 val past=grouped.filterKeys{it!=today}
 val todayTotal=todayRows.sumOf(::salesAttendanceDuration)
 var allToday by rememberSaveable{mutableStateOf(false)}
 var showPast by rememberSaveable{mutableStateOf(false)}
 val expandedDays=remember{mutableStateMapOf<String,Boolean>()}

 LazyColumn(
  Modifier.fillMaxSize().padding(horizontal=16.dp),
  contentPadding=PaddingValues(vertical=16.dp),
  verticalArrangement=Arrangement.spacedBy(12.dp),
 ){
  item{
   Text("My Attendance",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   Text("Today’s attendance is shown first.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  }
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}
  if(!state.loading&&state.message==null){
   item{
    Card(
     Modifier.fillMaxWidth(),
     shape=RoundedCornerShape(18.dp),
     colors=CardDefaults.cardColors(containerColor=Color(0xFFF7FAFF)),
     border=BorderStroke(1.dp,Color(0xFFDCE6F8)),
    ){
     Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
      Text("TODAY’S WORKHOURS",style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=SalesBlue)
      Text(salesDuration(todayTotal),style=MaterialTheme.typography.headlineLarge,fontWeight=FontWeight.Bold,color=SalesInk)
      Text("${todayRows.size} session${if(todayRows.size==1)"" else "s"} today",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
    }
   }
   item{
    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
     Text("Today’s Attendance",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
     Text(salesReportDateLabel(today),style=MaterialTheme.typography.bodySmall,color=SalesMuted)
    }
   }
   if(todayRows.isEmpty())item{ContentCard("No attendance today","No attendance session has been recorded today.")}
   else{
    val visible=if(todayRows.size>3&&!allToday)todayRows.take(3) else todayRows
    items(visible,key={it.salesText("id")?:it.toString()}){SalesAttendanceSessionCard(it)}
    if(todayRows.size>3)item{
     OutlinedButton({allToday=!allToday},Modifier.fillMaxWidth()){Text(if(allToday)"Show fewer sessions" else "View all ${todayRows.size} sessions")}
    }
   }
   item{
    Button(
     onClick={showPast=!showPast},
     modifier=Modifier.fillMaxWidth().heightIn(min=48.dp),
     colors=ButtonDefaults.buttonColors(containerColor=SalesNavy),
    ){Text(if(showPast)"Hide Past Attendance" else "Past Attendance · Last 35 Days")}
   }
   if(showPast){
    item{
     Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
      Text("Past Attendance",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
      Text("Latest date first",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
    }
    if(past.isEmpty())item{ContentCard("No past attendance","No past attendance was found in the last 35 days.")}
    past.forEach{(day,dayRowsUnsorted)->
     val dayRows=dayRowsUnsorted.sortedBy{salesEpoch(it.salesText("startedAt"))}
     val multiple=dayRows.size>1
     val expanded=expandedDays[day]?:false
     item(key="day-$day"){
      Card(
       Modifier.fillMaxWidth().then(if(multiple)Modifier.clickable{expandedDays[day]=!expanded} else Modifier),
       shape=RoundedCornerShape(16.dp),
       colors=CardDefaults.cardColors(containerColor=Color.White),
       border=BorderStroke(1.dp,SalesLine),
      ){
       Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
         Text(salesReportDateLabel(day),fontWeight=FontWeight.Bold,color=SalesInk)
         Text(if(multiple)"${dayRows.size} sessions ${if(expanded)"⌃" else "⌄"}" else "1 session",style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=SalesBlue)
        }
        SalesAttendanceDayStats(dayRows)
        if(!multiple||expanded){
         HorizontalDivider(color=SalesLine)
         Column(verticalArrangement=Arrangement.spacedBy(8.dp)){dayRows.forEach{SalesAttendanceSessionCard(it,compact=true)}}
        }
       }
      }
     }
    }
   }
  }
 }
}

@Composable
private fun SalesAttendanceDayStats(rows:List<JsonObject>){
 val first=rows.minByOrNull{salesEpoch(it.salesText("startedAt"))}
 val hasOpen=rows.any{it.salesText("endedAt")==null}
 val lastEnd=if(hasOpen)null else rows.mapNotNull{it.salesText("endedAt")}.maxByOrNull(::salesEpoch)
 val total=rows.sumOf(::salesAttendanceDuration)
 Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
  SalesAttendanceStat("START TIME",first?.salesText("startedAt")?.let(::salesReportTime)?:"—",Modifier.weight(1f))
  SalesAttendanceStat("END TIME",lastEnd?.let(::salesReportTime)?:if(hasOpen)"Now" else "—",Modifier.weight(1f))
  SalesAttendanceStat("TOTAL",salesDuration(total),Modifier.weight(1f))
 }
}

@Composable
private fun SalesAttendanceStat(label:String,value:String,modifier:Modifier){
 Column(modifier){
  Text(label,style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesMuted)
  Text(value,style=MaterialTheme.typography.bodyMedium,fontWeight=FontWeight.Bold,color=SalesInk)
 }
}

@Composable
private fun SalesAttendanceSessionCard(row:JsonObject,compact:Boolean=false){
 val start=row.salesText("startedAt")
 val end=row.salesText("endedAt")
 val content=if(compact)Modifier.fillMaxWidth().padding(vertical=2.dp) else Modifier.fillMaxWidth()
 val inner:@Composable ()->Unit={
  Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
   Column(Modifier.weight(1f)){
    Text("START TIME",style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesMuted)
    Text(start?.let(::salesReportTime)?:"—",fontWeight=FontWeight.Bold,color=SalesInk)
   }
   Surface(shape=RoundedCornerShape(50),color=Color(0xFFEEF3FF)){
    Text(salesDuration(salesAttendanceDuration(row)),Modifier.padding(horizontal=8.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesBlue)
   }
   Column(Modifier.weight(1f),horizontalAlignment=Alignment.End){
    Text("END TIME",style=MaterialTheme.typography.labelSmall,fontWeight=FontWeight.Bold,color=SalesMuted)
    Text(end?.let(::salesReportTime)?:"Now",fontWeight=FontWeight.Bold,color=if(end==null)Color(0xFFB54708) else SalesInk)
   }
  }
 }
 if(compact)Box(content){inner()}
 else OutlinedCard(content,shape=RoundedCornerShape(14.dp),border=BorderStroke(1.dp,SalesLine)){Box(Modifier.padding(13.dp)){inner()}}
}

private fun JsonObject.salesText(key:String)=this[key]?.jsonPrimitive?.contentOrNull
private fun JsonObject.salesObjText(key:String,child:String)=this[key]?.jsonObject?.get(child)?.jsonPrimitive?.contentOrNull
private fun salesEpoch(value:String?):Long=value?.let{runCatching{OffsetDateTime.parse(it).toInstant().toEpochMilli()}.getOrNull()}?:0L
private fun salesAttendanceDay(value:String?):String=value?.let{runCatching{OffsetDateTime.parse(it).atZoneSameInstant(salesReportZone).toLocalDate().toString()}.getOrNull()}.orEmpty()
private fun salesAttendanceDuration(row:JsonObject):Long{
 val start=salesEpoch(row.salesText("startedAt"));if(start==0L)return 0L
 val end=row.salesText("endedAt")?.let(::salesEpoch)?.takeIf{it>0L}?:System.currentTimeMillis()
 return (end-start).coerceAtLeast(0L)
}
private fun salesReportTime(value:String)=runCatching{OffsetDateTime.parse(value).atZoneSameInstant(salesReportZone).format(DateTimeFormatter.ofPattern("h:mm a"))}.getOrDefault(value)
private fun salesReportDateTime(value:String)=runCatching{OffsetDateTime.parse(value).atZoneSameInstant(salesReportZone).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.getOrDefault(value)
private fun salesReportDateLabel(value:String)=runCatching{LocalDate.parse(value).format(DateTimeFormatter.ofPattern("d MMM yyyy"))}.getOrDefault(value)
private fun salesDuration(ms:Long):String{
 val hours=ms/3_600_000
 val minutes=(ms%3_600_000)/60_000
 return "${hours}h ${minutes}m"
}
