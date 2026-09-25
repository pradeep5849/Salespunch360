package com.salespunch360.mobile.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.launch

private val PrimaryAdminItems=listOf("Dashboard","Employees","Branches","Attendance","Customers","Leads","Telecalling","Follow-ups","Targets","Settings","Reports")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrimaryAdminAuthenticatedApp(
 data:Bootstrap,
 message:String?,
 dismiss:()->Unit,
 logout:()->Unit,
 switchToAccount:(()->Unit)?=null
){
 val drawer=rememberDrawerState(DrawerValue.Closed)
 val scope=rememberCoroutineScope()
 val nav=rememberMobileRouteHistory("Dashboard")
 val route=nav.current
 var profileMenu by remember{mutableStateOf(false)}
 var pendingLeadId by remember{mutableStateOf<String?>(null)}
 var visitTask by remember{mutableStateOf<FollowUpTask?>(null)}

 fun navigate(value:String){
  pendingLeadId=null
  visitTask=null
  nav.navigate(value)
  scope.launch{drawer.close()}
 }

 BackHandler(enabled=drawer.isOpen){scope.launch{drawer.close()}}
 BackHandler(enabled=!drawer.isOpen&&visitTask!=null){visitTask=null}
 BackHandler(enabled=!drawer.isOpen&&visitTask==null&&nav.canGoBack){
  pendingLeadId=null
  nav.back()
 }

 ModalNavigationDrawer(
  drawerState=drawer,
  drawerContent={
   ModalDrawerSheet(Modifier.width(300.dp),drawerContainerColor=SalesNavy){
    Column(Modifier.fillMaxSize()){
     Spacer(Modifier.height(12.dp))
     Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom=8.dp)){
      PrimaryAdminItems.forEach{item->
       CompactAdminDrawerItem(
        label=item,
        selected=if(item=="Reports") route=="Reports"||route.startsWith("Report:") else route==item,
        onClick={navigate(item)}
       )
      }
     }
     if(switchToAccount!=null){
      HorizontalDivider(Modifier.padding(horizontal=16.dp),color=Color.White.copy(alpha=.18f))
      CompactAdminDrawerItem(
       label="⇄  Switch to Accounts",
       selected=false,
       onClick={scope.launch{drawer.close()};switchToAccount()}
      )
      Spacer(Modifier.height(8.dp))
     }
    }
   }
  }
 ){
  Scaffold(
   containerColor=SalesPale,
   topBar={
    TopAppBar(
     colors=TopAppBarDefaults.topAppBarColors(containerColor=Color.White),
     navigationIcon={IconButton({scope.launch{drawer.open()}}){Icon(Icons.Default.Menu,"Open menu")}},
     title={CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)},
     actions={
      Box{
       IconButton({profileMenu=true}){
        Surface(shape=CircleShape,color=Color(0xFFEAF3FF)){
         Box(Modifier.size(42.dp),contentAlignment=Alignment.Center){Text(data.user.name.trim().firstOrNull()?.uppercase()?:"P",color=SalesBlue,fontWeight=FontWeight.Bold)}
        }
       }
       DropdownMenu(expanded=profileMenu,onDismissRequest={profileMenu=false}){
        DropdownMenuItem(text={Text("Company Details")},onClick={profileMenu=false;navigate("Company Details")})
        DropdownMenuItem(text={Text("Follow-up Tasks")},onClick={profileMenu=false;navigate("Follow-ups")})
        DropdownMenuItem(text={Text("Billing & Subscription")},onClick={profileMenu=false;navigate("Billing & Subscription")})
        DropdownMenuItem(text={Text("Change Password")},onClick={profileMenu=false;navigate("Change Password")})
        HorizontalDivider()
        DropdownMenuItem(text={Text("Logout")},onClick={profileMenu=false;logout()})
       }
      }
     }
    )
   }
  ){padding->
   Column(Modifier.padding(padding).fillMaxSize()){
    message?.let{MessageBanner(it,dismiss)}
    when{
     visitTask!=null->PrimaryVisitDetails(visitTask!!){visitTask=null}
     route=="Dashboard"->AdminOverviewScreen(data,MobileRole.PRIMARY_ADMIN){navigate("Report:check-ins")}
     route=="Employees"->EmployeesScreen()
     route=="Branches"->BranchesScreen()
     route=="Attendance"->TeamAttendanceScreen(MobileRole.PRIMARY_ADMIN)
     route=="Customers"->CustomerAdminScreen()
     route=="Leads"->LeadsScreen(pendingLeadId,{pendingLeadId=null})
     route=="Telecalling"->TelecallingScreen()
     route=="Follow-ups"->FollowUpsScreen(startCheckIn={},viewLead={pendingLeadId=it;nav.navigate("Leads")},viewVisit={visitTask=it})
     route=="Targets"->TargetsScreen(MobileRole.PRIMARY_ADMIN)
     route=="Billing & Subscription"->SubscriptionScreen()
     route=="Settings"->SettingsScreen()
     route=="Reports"->ReportsScreen(showMenu=true,role=MobileRole.PRIMARY_ADMIN)
     route.startsWith("Report:")->ReportsScreen(initialType=route.substringAfter(':'),showMenu=false,role=MobileRole.PRIMARY_ADMIN)
     route=="Company Details"->CompanyProfileScreen()
     route=="Change Password"->ChangePasswordScreen()
     else->AdminOverviewScreen(data,MobileRole.PRIMARY_ADMIN){navigate("Report:check-ins")}
    }
   }
  }
 }
}

@Composable
private fun CompactAdminDrawerItem(label:String,selected:Boolean,onClick:()->Unit){
 val bg=if(selected)Color.White.copy(alpha=.14f) else Color.Transparent
 Row(
  Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=1.dp).height(43.dp).clip(RoundedCornerShape(22.dp)).background(bg).clickable(onClick=onClick).padding(horizontal=18.dp),
  verticalAlignment=Alignment.CenterVertically
 ){
  Text(label,fontSize=13.sp,color=Color.White,fontWeight=if(selected)FontWeight.Bold else FontWeight.SemiBold)
 }
}

@Composable
private fun PrimaryVisitDetails(task:FollowUpTask,back:()->Unit){
 Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  TextButton(back){Text("← Back")}
  Text("Visit Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
  ContentCard(task.subjectName,"Sales: ${task.completedVisitUserName?:task.assignedUserName?:"—"}"){
   task.checkedInAt?.let{Text("Check-in: $it")}
   task.checkedOutAt?.let{Text("Checkout: $it")}
   StatusChip(if(task.checkedOutAt==null)"Checkout pending" else "Checkout completed")
  }
 }
}
