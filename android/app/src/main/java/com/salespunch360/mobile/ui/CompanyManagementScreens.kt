package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.CompanyViewModel
import com.salespunch360.mobile.data.*

@Composable fun SettingsScreen(vm:CompanyViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;val c=state.context?.company
 if(state.loading&&c==null){LoadingScreen("Loading company settings…");return};if(c==null){RetryScreen(state.message?:"Settings unavailable.",vm::load);return}
 var attendance by remember(c){mutableStateOf(c.attendanceEnabled)};var gps by remember(c){mutableStateOf(c.gpsTrackingEnabled)};var checkout by remember(c){mutableStateOf(c.checkoutRequiredBeforeNextCheckIn)}
 var attendanceGeo by remember(c){mutableStateOf(c.attendanceGeofenceEnabled)};var customerGeo by remember(c){mutableStateOf(c.customerCheckInGeofenceEnabled)};var lat by remember(c){mutableStateOf(c.attendanceReferenceLatitude?:"")};var lng by remember(c){mutableStateOf(c.attendanceReferenceLongitude?:"")};var ar by remember(c){mutableStateOf(c.attendanceGeofenceRadiusMeters?.toString()?:"")};var cr by remember(c){mutableStateOf(c.customerCheckInGeofenceRadiusMeters?.toString()?:"")};var travel by remember(c){mutableStateOf(c.travelRatePerKm?:"")}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Operational Settings",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Text("Same authoritative settings as the Web workspace.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
  item{ContentCard("Field Operations","Attendance, GPS and visit flow."){SettingSwitch("Attendance enabled",attendance){attendance=it};SettingSwitch("GPS tracking enabled",gps){gps=it};SettingSwitch("Checkout before next check-in",checkout){checkout=it};Button({vm.saveOperations(OperationsSettings(attendance,gps,checkout))},enabled=!state.saving,modifier=Modifier.fillMaxWidth()){Text(if(state.saving)"Saving…" else "Save Field Settings")}}}
  item{ContentCard("Geofence Enforcement","Distance rules are validated by the server."){SettingSwitch("Attendance start geofence",attendanceGeo){attendanceGeo=it};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedTextField(lat,{lat=it},label={Text("Latitude")},modifier=Modifier.weight(1f));OutlinedTextField(lng,{lng=it},label={Text("Longitude")},modifier=Modifier.weight(1f))};OutlinedTextField(ar,{ar=it.filter(Char::isDigit)},label={Text("Attendance radius (m)")},modifier=Modifier.fillMaxWidth());HorizontalDivider();SettingSwitch("Customer check-in geofence",customerGeo){customerGeo=it};OutlinedTextField(cr,{cr=it.filter(Char::isDigit)},label={Text("Customer radius (m)")},modifier=Modifier.fillMaxWidth());Button({vm.saveGeofence(GeofenceSettings(attendanceGeo,lat.ifBlank{null},lng.ifBlank{null},ar.toIntOrNull(),customerGeo,cr.toIntOrNull()))},enabled=!state.saving,modifier=Modifier.fillMaxWidth()){Text("Save Geofence")}}}
  item{ContentCard("Travel Allowance","Default rate for employees using the company travel rate."){OutlinedTextField(travel,{travel=it.filter{ch->ch.isDigit()||ch=='.'}},label={Text("Default travel rate (₹ / km)")},singleLine=true,modifier=Modifier.fillMaxWidth());Button({travel.toDoubleOrNull()?.let{vm.saveTravel(TravelRateSettings(it))}},enabled=!state.saving&&travel.toDoubleOrNull()!=null,modifier=Modifier.fillMaxWidth()){Text("Save Travel Rate")}}}
  state.message?.let{item{ContentCard("Status",it)}}
 }
}

@Composable private fun SettingSwitch(label:String,checked:Boolean,change:(Boolean)->Unit){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(label,Modifier.weight(1f));Switch(checked,change)}}

@Composable fun GeofenceScreen(vm:CompanyViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;val c=state.context?.company;if(state.loading&&c==null){LoadingScreen("Loading geofence settings…");return};if(c==null){RetryScreen(state.message?:"Geofence unavailable.",vm::load);return};var attendance by remember(c){mutableStateOf(c.attendanceGeofenceEnabled)};var customer by remember(c){mutableStateOf(c.customerCheckInGeofenceEnabled)};var lat by remember(c){mutableStateOf(c.attendanceReferenceLatitude?:"")};var lng by remember(c){mutableStateOf(c.attendanceReferenceLongitude?:"")};var ar by remember(c){mutableStateOf(c.attendanceGeofenceRadiusMeters?.toString()?:"")};var cr by remember(c){mutableStateOf(c.customerCheckInGeofenceRadiusMeters?.toString()?:"")};LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){item{Text("Geofence",style=MaterialTheme.typography.headlineSmall);Text("Radius must be 10–100000 metres.")};item{SettingSwitch("Attendance start enforcement",attendance){attendance=it};OutlinedTextField(lat,{lat=it},label={Text("Reference latitude")},modifier=Modifier.fillMaxWidth());OutlinedTextField(lng,{lng=it},label={Text("Reference longitude")},modifier=Modifier.fillMaxWidth());OutlinedTextField(ar,{ar=it},label={Text("Attendance radius (m)")},modifier=Modifier.fillMaxWidth());HorizontalDivider();SettingSwitch("Customer check-in enforcement",customer){customer=it};OutlinedTextField(cr,{cr=it},label={Text("Customer radius (m)")},modifier=Modifier.fillMaxWidth());Button({vm.saveGeofence(GeofenceSettings(attendance,lat.ifBlank{null},lng.ifBlank{null},ar.toIntOrNull(),customer,cr.toIntOrNull()))},enabled=!state.saving,modifier=Modifier.fillMaxWidth()){Text(if(state.saving)"Saving…" else "Save geofence")}};state.message?.let{item{ContentCard("Status",it)}}}}

@Composable fun CompanySubscriptionInfoScreen(vm:CompanyViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;val r=state.context;if(state.loading&&r==null){LoadingScreen("Loading subscription…");return};if(r==null){RetryScreen(state.message?:"Subscription unavailable.",vm::load);return};val c=r.company;val e=r.entitlement;LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text("Subscription",style=MaterialTheme.typography.headlineSmall);StatusChip(e.state);ContentCard("Sales workspace seats",subscriptionSeatLines(e,c.teamStructure).joinToString("\n"))};items(r.prices.filter{it.role in visiblePricingRoles(c.teamStructure)&&it.period!="MONTHLY"}){p->ContentCard("${p.role.replace('_',' ')} · ${p.period.replace('_',' ')}","${p.currency} ${p.amount}")}}}
