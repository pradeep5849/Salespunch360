package com.salespunch360.mobile.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.launch

private val PrimaryAdminItems=listOf("Dashboard","Employees","Branches","Attendance","Customers","Leads","Follow-ups","Targets","Settings","Reports")
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun PrimaryAdminAuthenticatedApp(data:Bootstrap,message:String?,dismiss:()->Unit,logout:()->Unit,switchToAccount:(()->Unit)?=null){
 val drawer=rememberDrawerState(DrawerValue.Closed);val scope=rememberCoroutineScope();var route by rememberSaveable{mutableStateOf("Dashboard")};var profileMenu by remember{mutableStateOf(false)};var pendingLeadId by remember{mutableStateOf<String?>(null)};var visitTask by remember{mutableStateOf<FollowUpTask?>(null)};var reportType by rememberSaveable{mutableStateOf<String?>(null)}
 fun navigate(value:String){route=value;visitTask=null;reportType=null;scope.launch{drawer.close()}}
 BackHandler(enabled=visitTask!=null){visitTask=null};BackHandler(enabled=visitTask==null&&route!="Dashboard"){pendingLeadId=null;reportType=null;route="Dashboard"}
 ModalNavigationDrawer(drawerState=drawer,drawerContent={ModalDrawerSheet(Modifier.width(300.dp),drawerContainerColor=SalesNavy){Spacer(Modifier.height(22.dp));PrimaryAdminItems.forEach{item->NavigationDrawerItem(label={Text(item,fontSize=13.sp,fontWeight=FontWeight.SemiBold)},selected=route==item,onClick={navigate(item)},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent,selectedContainerColor=Color.White.copy(alpha=.12f),unselectedTextColor=Color.White,selectedTextColor=Color.White),modifier=Modifier.padding(horizontal=12.dp,vertical=2.dp))};if(switchToAccount!=null){HorizontalDivider(Modifier.padding(16.dp),color=Color.White.copy(alpha=.18f));NavigationDrawerItem(label={Text("⇄  Switch to Accounts",fontSize=13.sp,color=Color.White)},selected=false,onClick={scope.launch{drawer.close()};switchToAccount()},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent),modifier=Modifier.padding(horizontal=12.dp))}}}){
  Scaffold(containerColor=SalesPale,topBar={TopAppBar(colors=TopAppBarDefaults.topAppBarColors(containerColor=Color.White),navigationIcon={IconButton({scope.launch{drawer.open()}}){Icon(Icons.Default.Menu,"Open menu")}},title={CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)},actions={Box{IconButton({profileMenu=true}){Surface(shape=CircleShape,color=Color(0xFFEAF3FF)){Box(Modifier.size(42.dp),contentAlignment=Alignment.Center){Text(data.user.name.trim().firstOrNull()?.uppercase()?:"P",color=SalesBlue,fontWeight=FontWeight.Bold)}}};DropdownMenu(expanded=profileMenu,onDismissRequest={profileMenu=false}){DropdownMenuItem(text={Text("Company Details")},onClick={profileMenu=false;route="Company Details"});DropdownMenuItem(text={Text("Follow-up Tasks")},onClick={profileMenu=false;route="Follow-ups"});DropdownMenuItem(text={Text("Billing & Subscription")},onClick={profileMenu=false;route="Billing & Subscription"});DropdownMenuItem(text={Text("Change Password")},onClick={profileMenu=false;route="Change Password"});HorizontalDivider();DropdownMenuItem(text={Text("Logout")},onClick={profileMenu=false;logout()})}}})}){padding->Column(Modifier.padding(padding).fillMaxSize()){message?.let{MessageBanner(it,dismiss)};when{
   visitTask!=null->PrimaryVisitDetails(visitTask!!){visitTask=null}
   route=="Dashboard"->AdminOverviewScreen(data,MobileRole.PRIMARY_ADMIN){route="Reports";reportType="check-ins"}
   route=="Employees"->EmployeesScreen()
   route=="Branches"->BranchesScreen()
   route=="Attendance"->TeamAttendanceScreen(MobileRole.PRIMARY_ADMIN)
   route=="Customers"->CustomerAdminScreen()
   route=="Leads"->LeadsScreen(pendingLeadId,{pendingLeadId=null})
   route=="Follow-ups"->FollowUpsScreen(startCheckIn={},viewLead={pendingLeadId=it;route="Leads"},viewVisit={visitTask=it})
   route=="Targets"->TargetsScreen(MobileRole.PRIMARY_ADMIN)
   route=="Billing & Subscription"->SubscriptionScreen()
   route=="Settings"->SettingsScreen()
   route=="Reports"->ReportsScreen(initialType=reportType,showMenu=reportType==null,role=MobileRole.PRIMARY_ADMIN)
   route=="Company Details"->CompanyProfileScreen()
   route=="Change Password"->ChangePasswordScreen()
   else->AdminOverviewScreen(data,MobileRole.PRIMARY_ADMIN){route="Reports";reportType="check-ins"}
  }}}
 }
}
@Composable private fun PrimaryVisitDetails(task:FollowUpTask,back:()->Unit){Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){TextButton(back){Text("← Back")};Text("Visit Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard(task.subjectName,"Sales: ${task.completedVisitUserName?:task.assignedUserName?:"—"}"){task.checkedInAt?.let{Text("Check-in: $it")};task.checkedOutAt?.let{Text("Checkout: $it")};StatusChip(if(task.checkedOutAt==null)"Checkout pending" else "Checkout completed")}}}
