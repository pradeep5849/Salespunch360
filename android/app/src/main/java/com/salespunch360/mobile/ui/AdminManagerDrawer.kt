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

private fun roleMenu(data:Bootstrap):List<String>{val role=data.user.salesRole;val fieldManager=role==MobileRole.MANAGER&&data.user.managerType!="MANAGER_ONLY";return buildList{add("Dashboard");if(data.capabilities.canManageEmployees)add("Employees");add("Attendance");add("Customers");if(fieldManager)add("Check-ins");add("Leads");add("Follow-ups");add("Targets");if(data.capabilities.canManageSalesSettings)add("Settings");add("Reports")}}
private fun roleReportItems(role:MobileRole)=if(role==MobileRole.MANAGER)listOf("Check-in Report" to "check-ins","Advanced Check-in" to "advanced-check-ins","Attendance Report" to "attendance","GPS Route Report" to "gps","Geofence Report" to "geofence","Lead Report" to "leads","Target Analysis" to "targets")else listOf("Check-in Report" to "check-ins","Advanced Check-in" to "advanced-check-ins","Attendance Report" to "attendance","GPS Route Report" to "gps","Geofence Report" to "geofence","Lead Report" to "leads","Target Analysis" to "targets","Expense Report" to "expenses")

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AdminManagerAuthenticatedApp(data:Bootstrap,message:String?,dismiss:()->Unit,attendance:(Boolean,LocationPayload,()->Unit)->Unit,logout:()->Unit,switchToAccount:(()->Unit)?=null){
 val role=data.user.salesRole?:return;val fieldManager=role==MobileRole.MANAGER&&data.user.managerType!="MANAGER_ONLY";val drawer=rememberDrawerState(DrawerValue.Closed);val scope=rememberCoroutineScope();var route by rememberSaveable(role){mutableStateOf("Dashboard")};var reportOpen by rememberSaveable{mutableStateOf(false)};var reportType by rememberSaveable{mutableStateOf<String?>(null)};var profileMenu by remember{mutableStateOf(false)};var pendingLeadId by remember{mutableStateOf<String?>(null)};var visitTask by remember{mutableStateOf<FollowUpTask?>(null)};var checkInTask by remember{mutableStateOf<FollowUpTask?>(null)};var checkInLead by remember{mutableStateOf<LeadSummary?>(null)}
 fun navigate(value:String){route=value;reportType=null;visitTask=null;if(value!="Check-ins"){checkInTask=null;checkInLead=null};scope.launch{drawer.close()}}
 BackHandler(enabled=visitTask!=null){visitTask=null};BackHandler(enabled=visitTask==null&&(route!="Dashboard"||reportType!=null)){pendingLeadId=null;reportType=null;reportOpen=false;route="Dashboard"}
 ModalNavigationDrawer(drawerState=drawer,drawerContent={ModalDrawerSheet(Modifier.width(300.dp),drawerContainerColor=SalesNavy){Spacer(Modifier.height(22.dp));roleMenu(data).forEach{item->if(item=="Reports"){NavigationDrawerItem(label={Text("Reports",fontSize=13.sp,fontWeight=FontWeight.SemiBold)},selected=route=="Reports",onClick={reportOpen=!reportOpen},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent,selectedContainerColor=Color.White.copy(alpha=.12f),unselectedTextColor=Color.White,selectedTextColor=Color.White),modifier=Modifier.padding(horizontal=12.dp,vertical=2.dp));if(reportOpen)roleReportItems(role).forEach{(label,type)->TextButton(onClick={route="Reports";reportType=type;scope.launch{drawer.close()}},modifier=Modifier.fillMaxWidth().padding(start=34.dp)){Text(label,Modifier.fillMaxWidth(),fontSize=11.sp,color=Color.White)}}}else NavigationDrawerItem(label={Text(item,fontSize=13.sp,fontWeight=FontWeight.SemiBold)},selected=route==item,onClick={navigate(item)},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent,selectedContainerColor=Color.White.copy(alpha=.12f),unselectedTextColor=Color.White,selectedTextColor=Color.White),modifier=Modifier.padding(horizontal=12.dp,vertical=2.dp))};if(switchToAccount!=null){HorizontalDivider(Modifier.padding(16.dp),color=Color.White.copy(alpha=.18f));NavigationDrawerItem(label={Text("⇄  Switch to Accounts",fontSize=13.sp,color=Color.White)},selected=false,onClick={scope.launch{drawer.close()};switchToAccount()},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent),modifier=Modifier.padding(horizontal=12.dp))}}}){
  Scaffold(containerColor=SalesPale,topBar={TopAppBar(colors=TopAppBarDefaults.topAppBarColors(containerColor=Color.White),navigationIcon={IconButton({scope.launch{drawer.open()}}){Icon(Icons.Default.Menu,"Open menu")}},title={CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)},actions={Box{IconButton({profileMenu=true}){Surface(shape=CircleShape,color=Color(0xFFEAF3FF)){Box(Modifier.size(42.dp),contentAlignment=Alignment.Center){Text(data.user.name.trim().firstOrNull()?.uppercase()?:"U",color=SalesBlue,fontWeight=FontWeight.Bold)}}};DropdownMenu(expanded=profileMenu,onDismissRequest={profileMenu=false}){DropdownMenuItem(text={Text("Company Details")},onClick={profileMenu=false;route="Company Details"});DropdownMenuItem(text={Text("Follow-up Tasks")},onClick={profileMenu=false;route="Follow-ups"});if(role!=MobileRole.ADMIN&&data.capabilities.canAccessSalesBilling)DropdownMenuItem(text={Text("Billing & Subscription")},onClick={profileMenu=false;route="Billing & Subscription"});DropdownMenuItem(text={Text("Change Password")},onClick={profileMenu=false;route="Change Password"});HorizontalDivider();DropdownMenuItem(text={Text("Logout")},onClick={profileMenu=false;logout()})}}})}){padding->Column(Modifier.padding(padding).fillMaxSize()){message?.let{MessageBanner(it,dismiss)};when{
   visitTask!=null->RoleVisitDetails(visitTask!!){visitTask=null}
   route=="Dashboard"->AdminOverviewScreen(data,role){route="Reports";reportType="check-ins"}
   route=="Employees"->EmployeesScreen()
   route=="Attendance"->if(fieldManager)FieldManagerAttendanceScreen(data,attendance)else TeamAttendanceScreen(role)
   route=="Customers"->if(role==MobileRole.ADMIN)CustomerAdminScreen()else CustomersScreen{if(fieldManager)route="Check-ins"}
   route=="Check-ins"&&fieldManager->FieldScreen(initialFollowUpTask=checkInTask,onInitialFollowUpConsumed={checkInTask=null},initialLead=checkInLead,onInitialLeadConsumed={checkInLead=null},onViewPipeline={route="Leads"})
   route=="Leads"->LeadsScreen(pendingLeadId,{pendingLeadId=null},onCheckIn={lead->if(fieldManager){checkInLead=lead;route="Check-ins"}})
   route=="Follow-ups"->FollowUpsScreen(startCheckIn={task->if(fieldManager){checkInTask=task;route="Check-ins"}},viewLead={pendingLeadId=it;route="Leads"},viewVisit={visitTask=it})
   route=="Targets"->TargetsScreen(role)
   route=="Billing & Subscription"&&role!=MobileRole.ADMIN->SubscriptionScreen()
   route=="Settings"->SettingsScreen()
   route=="Reports"->ReportsScreen(initialType=reportType,showMenu=reportType==null,role=role)
   route=="Company Details"->RoleCompanyDetails(data)
   route=="Change Password"->ChangePasswordScreen()
   else->AdminOverviewScreen(data,role){route="Reports";reportType="check-ins"}
  }}}
 }
}
@Composable private fun RoleVisitDetails(task:FollowUpTask,back:()->Unit){Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){TextButton(back){Text("← Back")};Text("Visit Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard(task.subjectName,"Sales: ${task.completedVisitUserName?:task.assignedUserName?:"—"}"){task.checkedInAt?.let{Text("Check-in: $it")};task.checkedOutAt?.let{Text("Checkout: $it")};StatusChip(if(task.checkedOutAt==null)"Checkout pending" else "Checkout completed")}}}
@Composable private fun RoleCompanyDetails(data:Bootstrap){Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("Company Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard(data.company.name,data.company.address?:"Company address is not available."){CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)}}}
