package com.salespunch360.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal data class SalesDrawerDestination(val label:String,val route:String,val icon:ImageVector)
private val salesDrawerDestinations=listOf(
 SalesDrawerDestination("Dashboard","Dashboard",Icons.Default.Home),
 SalesDrawerDestination("Attendance","Attendance",Icons.Default.AccessTime),
 SalesDrawerDestination("Customers","Customers",Icons.Default.People),
 SalesDrawerDestination("Check-ins","Check-ins",Icons.Default.LocationOn),
 SalesDrawerDestination("Leads","Leads",Icons.Default.FilterAlt),
 SalesDrawerDestination("Follow-ups","Follow-ups",Icons.Default.EventNote),
 SalesDrawerDestination("Targets","Targets",Icons.Default.TrackChanges)
)
private val salesDrawerReports=listOf(
 "Check-in Report" to "Report:check-ins",
 "My Attendance" to "Report:attendance",
 "My Travel / Distance" to "Report:gps",
 "My Performance" to "Report:targets"
)
@Composable internal fun SalesNavigationDrawerContent(current:String?,companyName:String,userName:String,navigate:(String)->Unit){var reportsExpanded by rememberSaveable{mutableStateOf(current?.startsWith("Report:")==true)};Column(Modifier.fillMaxSize().background(SalesNavy).statusBarsPadding().padding(vertical=18.dp)){Column(Modifier.padding(horizontal=20.dp,vertical=8.dp)){Text(companyName,color=Color.White,fontWeight=FontWeight.Bold,style=MaterialTheme.typography.titleMedium);Text(userName,color=Color.White.copy(alpha=.7f),style=MaterialTheme.typography.bodySmall)};Spacer(Modifier.height(12.dp));salesDrawerDestinations.forEach{item->DrawerRow(item.label,item.icon,current==item.route){navigate(item.route)}};DrawerRow("Reports",Icons.Default.Assessment,current?.startsWith("Report:")==true||current=="Reports",trailing=if(reportsExpanded)"▲" else "▼"){reportsExpanded=!reportsExpanded};if(reportsExpanded)salesDrawerReports.forEach{(label,route)->Row(Modifier.fillMaxWidth().clickable{navigate(route)}.padding(start=58.dp,end=18.dp,top=11.dp,bottom=11.dp),verticalAlignment=Alignment.CenterVertically){Text(label,fontSize=11.sp,color=if(current==route)Color.White else Color.White.copy(alpha=.78f),fontWeight=if(current==route)FontWeight.Bold else FontWeight.Normal)}}}}
@Composable private fun DrawerRow(label:String,icon:ImageVector,selected:Boolean,trailing:String?=null,onClick:()->Unit){val bg=if(selected)Color.White.copy(alpha=.12f) else Color.Transparent;Row(Modifier.fillMaxWidth().background(bg).clickable(onClick=onClick).padding(horizontal=20.dp,vertical=13.dp),verticalAlignment=Alignment.CenterVertically){Icon(icon,null,tint=Color.White,modifier=Modifier.size(22.dp));Spacer(Modifier.width(16.dp));Text(label,Modifier.weight(1f),fontSize=13.sp,color=Color.White,fontWeight=if(selected)FontWeight.Bold else FontWeight.Medium);trailing?.let{Text(it,fontSize=11.sp,color=Color.White.copy(alpha=.8f))}}}
