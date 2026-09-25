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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.salespunch360.mobile.data.MobileRole

internal data class SalesDrawerDestination(val label:String,val route:String,val icon:ImageVector)
internal data class SalesReportDrawerItem(val label:String,val type:String)

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

internal fun salesReportDrawerItems(role:MobileRole)=when(role){
 MobileRole.PRIMARY_ADMIN,MobileRole.ADMIN->listOf(
  SalesReportDrawerItem("Check-in Report","check-ins"),
  SalesReportDrawerItem("Attendance Report","attendance"),
  SalesReportDrawerItem("GPS Report","gps"),
  SalesReportDrawerItem("Geofence Report","geofence"),
  SalesReportDrawerItem("Target Analysis","targets"),
  SalesReportDrawerItem("Expense Report","expenses")
 )
 MobileRole.MANAGER->listOf(
  SalesReportDrawerItem("Check-in Report","check-ins"),
  SalesReportDrawerItem("Attendance Report","attendance"),
  SalesReportDrawerItem("GPS Report","gps"),
  SalesReportDrawerItem("Geofence Report","geofence"),
  SalesReportDrawerItem("Target Analysis","targets")
 )
 MobileRole.SALES->listOf(
  SalesReportDrawerItem("Check-in Report","check-ins"),
  SalesReportDrawerItem("My Attendance","attendance"),
  SalesReportDrawerItem("My Travel / Distance","gps"),
  SalesReportDrawerItem("My Performance","targets")
 )
}

@Composable
internal fun SalesCompactNavigationMenu(
 expanded:Boolean,
 onDismiss:()->Unit,
 current:String?,
 telecaller:Boolean,
 navigate:(String)->Unit,
 switchToAccount:(()->Unit)?=null,
){
 val destinations=if(telecaller)telecallerDrawerDestinations else salesDrawerDestinations.filterNot{it.route=="Telecalling"}
 var reportsOpen by rememberSaveable{mutableStateOf(current?.startsWith("Report:")==true)}
 DropdownMenu(
  expanded=expanded,
  onDismissRequest=onDismiss,
  modifier=Modifier.width(248.dp),
  containerColor=SalesNavy,
 ){
  destinations.forEach{item->
   DropdownMenuItem(
    text={Text(item.label,color=Color.White,fontSize=13.sp,fontWeight=if(current==item.route)FontWeight.Bold else FontWeight.Medium)},
    leadingIcon={Icon(item.icon,null,tint=Color.White,modifier=Modifier.size(19.dp))},
    onClick={navigate(item.route)},
    contentPadding=PaddingValues(horizontal=14.dp,vertical=0.dp),
   )
  }
  if(!telecaller){
   DropdownMenuItem(
    text={Text("Reports",color=Color.White,fontSize=13.sp,fontWeight=if(current?.startsWith("Report:")==true)FontWeight.Bold else FontWeight.Medium)},
    leadingIcon={Icon(Icons.Default.Assessment,null,tint=Color.White,modifier=Modifier.size(19.dp))},
    trailingIcon={Text(if(reportsOpen)"⌃" else "⌄",color=Color.White)},
    onClick={reportsOpen=!reportsOpen},
    contentPadding=PaddingValues(horizontal=14.dp,vertical=0.dp),
   )
   if(reportsOpen){
    salesReportDrawerItems(MobileRole.SALES).forEach{report->
     DropdownMenuItem(
      text={Text(report.label,color=Color.White.copy(alpha=.9f),fontSize=12.sp)},
      onClick={navigate("Report:${report.type}")},
      contentPadding=PaddingValues(start=48.dp,end=14.dp),
     )
    }
   }
  }
  switchToAccount?.let{action->
   HorizontalDivider(color=Color.White.copy(alpha=.18f))
   DropdownMenuItem(
    text={Text("Switch to Accounts",color=Color.White,fontSize=13.sp)},
    leadingIcon={Icon(Icons.Default.SwapHoriz,null,tint=Color.White,modifier=Modifier.size(19.dp))},
    onClick={onDismiss();action()},
    contentPadding=PaddingValues(horizontal=14.dp,vertical=0.dp),
   )
  }
 }
}

@Composable
internal fun SalesReportsDrawerSection(
 role:MobileRole,
 current:String?,
 expanded:Boolean,
 setExpanded:(Boolean)->Unit,
 navigate:(String)->Unit
){
 val reports=salesReportDrawerItems(role)
 if(reports.isEmpty())return
 DrawerRow(
  "Reports",
  Icons.Default.Assessment,
  current?.startsWith("Report:")==true,
  onClick={setExpanded(!expanded)},
  trailing=if(expanded)"⌃" else "⌄"
 )
 if(expanded){
  reports.forEach{report->
   DrawerSubRow(report.label,current=="Report:${report.type}"){navigate("Report:${report.type}")}
  }
 }
}

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
 var reportsOpen by rememberSaveable{mutableStateOf(current?.startsWith("Report:")==true)}
 Column(Modifier.fillMaxSize().background(SalesNavy).statusBarsPadding()){
  Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(vertical=12.dp)){
   Column(Modifier.padding(horizontal=20.dp,vertical=6.dp)){
    Text(companyName,color=Color.White,fontWeight=FontWeight.Bold,style=MaterialTheme.typography.titleMedium)
    Text(userName,color=Color.White.copy(alpha=.7f),style=MaterialTheme.typography.bodySmall)
   }
   Spacer(Modifier.height(6.dp))
   destinations.forEach{item->DrawerRow(item.label,item.icon,current==item.route,onClick={navigate(item.route)})}
   if(!telecaller){
    SalesReportsDrawerSection(MobileRole.SALES,current,reportsOpen,{reportsOpen=it},navigate)
   }
  }
  switchToAccount?.let{action->
   HorizontalDivider(color=Color.White.copy(alpha=.18f))
   DrawerRow("Switch to Accounts",Icons.Default.SwapHoriz,false,onClick={action()})
   Spacer(Modifier.height(6.dp))
  }
 }
}

@Composable
private fun DrawerRow(label:String,icon:ImageVector,selected:Boolean,onClick:()->Unit,trailing:String?=null){
 val bg=if(selected)Color.White.copy(alpha=.12f) else Color.Transparent
 Row(Modifier.fillMaxWidth().background(bg).clickable(onClick=onClick).padding(horizontal=20.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically){
  Icon(icon,null,tint=Color.White,modifier=Modifier.size(20.dp))
  Spacer(Modifier.width(14.dp))
  Text(label,Modifier.weight(1f),fontSize=13.sp,color=Color.White,fontWeight=if(selected)FontWeight.Bold else FontWeight.Medium)
  trailing?.let{Text(it,color=Color.White.copy(alpha=.8f),fontSize=15.sp)}
 }
}

@Composable
private fun DrawerSubRow(label:String,selected:Boolean,onClick:()->Unit){
 val bg=if(selected)Color.White.copy(alpha=.1f) else Color.Transparent
 Row(
  Modifier.fillMaxWidth().background(bg).clickable(onClick=onClick).padding(start=54.dp,end=20.dp,top=8.dp,bottom=8.dp),
  verticalAlignment=Alignment.CenterVertically
 ){
  Text(label,fontSize=12.sp,color=Color.White.copy(alpha=if(selected)1f else .84f),fontWeight=if(selected)FontWeight.Bold else FontWeight.Medium)
 }
}
