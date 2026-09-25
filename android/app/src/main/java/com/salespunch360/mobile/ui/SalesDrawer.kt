package com.salespunch360.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
 SalesDrawerDestination("Telecalling","Telecalling",Icons.Default.Phone),
 SalesDrawerDestination("Follow-ups","Follow-ups",Icons.Default.EventNote),
 SalesDrawerDestination("Targets","Targets",Icons.Default.TrackChanges)
)
private val telecallerDrawerDestinations=listOf(
 SalesDrawerDestination("Dashboard","Dashboard",Icons.Default.Home),
 SalesDrawerDestination("Telecalling","Telecalling",Icons.Default.Phone)
)

@Composable
internal fun SalesNavigationDrawerContent(
 current:String?,
 companyName:String,
 userName:String,
 telecaller:Boolean=false,
 navigate:(String)->Unit,
 switchToAccount:(()->Unit)?=null
){
 val destinations=if(telecaller)telecallerDrawerDestinations else salesDrawerDestinations
 Column(Modifier.fillMaxSize().background(SalesNavy).statusBarsPadding()){
  Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(vertical=12.dp)){
   Column(Modifier.padding(horizontal=20.dp,vertical=6.dp)){
    Text(companyName,color=Color.White,fontWeight=FontWeight.Bold,style=MaterialTheme.typography.titleMedium)
    Text(userName,color=Color.White.copy(alpha=.7f),style=MaterialTheme.typography.bodySmall)
   }
   Spacer(Modifier.height(6.dp))
   destinations.forEach{item->DrawerRow(item.label,item.icon,current==item.route){navigate(item.route)}}
   if(!telecaller){
    DrawerRow("Reports",Icons.Default.Assessment,current?.startsWith("Report:")==true){navigate("Report:check-ins")}
   }
  }
  switchToAccount?.let{action->
   HorizontalDivider(color=Color.White.copy(alpha=.18f))
   DrawerRow("Switch to Accounts",Icons.Default.SwapHoriz,false){action()}
   Spacer(Modifier.height(6.dp))
  }
 }
}

@Composable
private fun DrawerRow(label:String,icon:ImageVector,selected:Boolean,onClick:()->Unit){
 val bg=if(selected)Color.White.copy(alpha=.12f) else Color.Transparent
 Row(Modifier.fillMaxWidth().background(bg).clickable(onClick=onClick).padding(horizontal=20.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically){
  Icon(icon,null,tint=Color.White,modifier=Modifier.size(20.dp))
  Spacer(Modifier.width(14.dp))
  Text(label,Modifier.weight(1f),fontSize=13.sp,color=Color.White,fontWeight=if(selected)FontWeight.Bold else FontWeight.Medium)
 }
}
