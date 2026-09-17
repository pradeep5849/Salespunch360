package com.salespunch360.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.DashboardViewModel

@Composable fun LiveTrackingCard(vm:DashboardViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;var expanded by remember{mutableStateOf(false)}
 Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.cardColors(containerColor=androidx.compose.ui.graphics.Color.White),border=BorderStroke(1.dp,SalesLine)){
  Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
   Text("Live Tracking",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
   Box(Modifier.fillMaxWidth()){
    OutlinedButton({expanded=true},Modifier.fillMaxWidth()){Text(state.employees.firstOrNull{it.id==state.selectedEmployeeId}?.name?:"Select employee")}
    DropdownMenu(expanded,{expanded=false}){state.employees.forEach{employee->DropdownMenuItem({Text(employee.name)},{expanded=false;vm.select(employee.id)})}}
   }
   Button(vm::view,enabled=state.selectedEmployeeId!=null&&!state.loading,modifier=Modifier.fillMaxWidth()){Text(if(state.loading)"Loading…" else "View")}
   state.message?.let{Text(it,color=SalesMuted,style=MaterialTheme.typography.bodySmall)}
   state.latestLocation?.let{location->HorizontalDivider(color=SalesLine);Text(location.user.name,fontWeight=FontWeight.Bold,color=SalesInk);Text("Latitude ${location.latitude} · Longitude ${location.longitude}",color=SalesMuted);Text("Last GPS ${trackingTime(location.capturedAt)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
  }
 }
}
private fun trackingTime(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.getOrDefault(value)
