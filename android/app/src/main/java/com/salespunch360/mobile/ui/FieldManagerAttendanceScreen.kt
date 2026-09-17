package com.salespunch360.mobile.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.data.LocationPayload
import com.salespunch360.mobile.data.MobileRole
import com.salespunch360.mobile.location.TrackingService
import kotlinx.coroutines.launch

@Composable fun FieldManagerAttendanceScreen(data:Bootstrap,attendance:(Boolean,LocationPayload,()->Unit)->Unit){
 val context=LocalContext.current;val scope=rememberCoroutineScope();var locating by remember{mutableStateOf(false)};var status by remember{mutableStateOf<String?>(null)}
 fun submit(start:Boolean){scope.launch{locating=true;status="Getting current location…";try{val point=com.salespunch360.mobile.location.currentDeviceLocation(context);attendance(start,point){if(start&&data.features.gpsTrackingEnabled)TrackingService.start(context);if(!start)TrackingService.stop(context)};status="Location ready"}catch(e:Exception){status=com.salespunch360.mobile.location.locationFailureMessage(e)}finally{locating=false}}}
 val launcher=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){if(it[Manifest.permission.ACCESS_FINE_LOCATION]==true)submit(data.attendance==null)else status="Precise location permission is required."}
 LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(bottom=8.dp)){
  item{Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){Text("Attendance",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);HorizontalDivider(color=SalesLine);Text("My attendance",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk);val active=data.attendance;if(active!=null)Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.cardColors(containerColor=Color(0xFFFFF7F7)),border=BorderStroke(1.dp,Color(0xFFE25A5A))){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text("ON ATTENDANCE",fontWeight=FontWeight.Bold,color=Color(0xFFC62828));Text("Started ${fieldManagerAttendanceTime(active.startedAt)}",color=SalesInk);if(data.features.gpsTrackingEnabled)Text("GPS tracking active · ${active.gpsPointCount} ${if(active.gpsPointCount==1)"point" else "points"}",color=SalesMuted);status?.let{Text(it,color=SalesMuted)};Button({launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))},enabled=!locating,modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=Color(0xFFC62828))){Text(if(locating)"Locating…" else "End Attendance")}}}else ContentCard("My attendance",if(data.features.attendanceEnabled)"Not currently working" else "Attendance is disabled by your company."){status?.let{Text(it,color=SalesMuted)};Button({launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))},enabled=!locating&&data.features.attendanceEnabled&&data.entitlement.operationalWritesAllowed,modifier=Modifier.fillMaxWidth()){Text(if(locating)"Locating…" else "Start Attendance")}}}}
  item{TeamAttendanceScreen(MobileRole.MANAGER)}
 }
}
private fun fieldManagerAttendanceTime(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))}.getOrDefault(value)
