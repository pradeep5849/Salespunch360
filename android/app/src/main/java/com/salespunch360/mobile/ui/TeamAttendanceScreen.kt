package com.salespunch360.mobile.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AttendanceOverviewViewModel
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.data.LocationPayload
import com.salespunch360.mobile.data.MobileRole
import com.salespunch360.mobile.location.TrackingService
import kotlinx.coroutines.launch

@Composable fun FieldManagerAttendanceScreen(data:Bootstrap,attendance:(Boolean,LocationPayload,()->Unit)->Unit){
 var tab by remember{mutableIntStateOf(0)}
 Column(Modifier.fillMaxSize()){
  TabRow(selectedTabIndex=tab){Tab(selected=tab==0,onClick={tab=0},text={Text("My Attendance")});Tab(selected=tab==1,onClick={tab=1},text={Text("Team Status")})}
  if(tab==0)FieldManagerSelfAttendance(data,attendance) else TeamAttendanceScreen(MobileRole.MANAGER)
 }
}

@Composable private fun FieldManagerSelfAttendance(data:Bootstrap,attendance:(Boolean,LocationPayload,()->Unit)->Unit){
 val context=LocalContext.current;val scope=rememberCoroutineScope();var locating by remember{mutableStateOf(false)};var status by remember{mutableStateOf<String?>(null)}
 fun submit(start:Boolean){scope.launch{locating=true;status="Getting current location…";try{val point=com.salespunch360.mobile.location.currentDeviceLocation(context);attendance(start,point){if(start&&data.features.gpsTrackingEnabled)TrackingService.start(context);if(!start)TrackingService.stop(context)};status="Location ready"}catch(e:Exception){status=com.salespunch360.mobile.location.locationFailureMessage(e)}finally{locating=false}}}
 val launcher=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){if(it[Manifest.permission.ACCESS_FINE_LOCATION]==true)submit(data.attendance==null)else status="Precise location permission is required."}
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text("Attendance",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);Text("Your field attendance",color=SalesMuted);HorizontalDivider(Modifier.padding(top=8.dp))};item{val active=data.attendance;if(active!=null)Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Color(0xFFFFF7F7)),border=BorderStroke(1.dp,Color(0xFFE25A5A))){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text("ON ATTENDANCE",fontWeight=FontWeight.Bold,color=Color(0xFFC62828));Text("Started ${attendanceOverviewTime(active.startedAt)}",color=SalesInk);if(data.features.gpsTrackingEnabled)Text("GPS tracking active · ${active.gpsPointCount} ${if(active.gpsPointCount==1)"point" else "points"}",color=SalesMuted);status?.let{Text(it,color=SalesMuted)};Button({launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))},enabled=!locating,modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=Color(0xFFC62828))){Text(if(locating)"Locating…" else "End Attendance")}}}else OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text("Not currently working",fontWeight=FontWeight.Bold,color=SalesInk);Text(if(data.features.attendanceEnabled)"Start attendance when you begin field work." else "Attendance is disabled by your company.",color=SalesMuted);status?.let{Text(it,color=SalesMuted)};Button({launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))},enabled=!locating&&data.features.attendanceEnabled&&data.entitlement.operationalWritesAllowed,modifier=Modifier.fillMaxWidth()){Text(if(locating)"Locating…" else "Start Attendance")}}}}}
}

@Composable fun TeamAttendanceScreen(role:MobileRole,vm:AttendanceOverviewViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Text("Attendance",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);HorizontalDivider(Modifier.padding(top=8.dp,bottom=10.dp),color=SalesLine);Text("Team attendance",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk);Text(if(role==MobileRole.MANAGER)"Current attendance status of your assigned sales team." else "Current attendance state for your company.",color=SalesMuted)}
  if(state.loading&&state.employees.isEmpty())item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text(it,color=SalesMuted);OutlinedButton(onClick=vm::load,enabled=!state.loading){Text("Retry")}}}}
  if(!state.loading&&state.employees.isEmpty()&&state.message==null)item{OutlinedCard(Modifier.fillMaxWidth()){Text("No team members to show.",Modifier.padding(16.dp),color=SalesMuted)}}
  items(state.employees,key={it.id}){employee->OutlinedCard(Modifier.fillMaxWidth(),border=BorderStroke(1.dp,SalesLine)){Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){Surface(shape=CircleShape,color=Color(0xFFEAF3FF)){Box(Modifier.size(42.dp),contentAlignment=Alignment.Center){Text(employee.name.trim().firstOrNull()?.uppercase()?:"U",fontWeight=FontWeight.Bold,color=SalesBlue)}};Column(Modifier.weight(1f)){Text(employee.name,fontWeight=FontWeight.Bold,color=SalesInk);Text(if(employee.salesRole==MobileRole.MANAGER)"Manager · Active employee" else "Sales · Active employee",style=MaterialTheme.typography.bodySmall,color=SalesMuted);if(employee.working&&employee.startedAt!=null)Text("Working since ${attendanceOverviewTime(employee.startedAt)} · ${employee.gpsPointCount} ${if(employee.gpsPointCount==1)"point" else "points"}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Surface(shape=CircleShape,color=if(employee.working)Color(0xFFE9F7EF) else Color(0xFFF2F3F5)){Text(if(employee.working)"Working" else "Not working",Modifier.padding(horizontal=10.dp,vertical=6.dp),style=MaterialTheme.typography.labelMedium,color=if(employee.working)Color(0xFF237A45) else SalesMuted)}}}}
 }
}
private fun attendanceOverviewTime(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))}.getOrDefault(value)
