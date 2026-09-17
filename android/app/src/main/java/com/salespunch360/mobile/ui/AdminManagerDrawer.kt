package com.salespunch360.mobile.ui

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
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.launch

private data class RoleMenuItem(val label:String)
private fun roleMenu(data:Bootstrap):List<RoleMenuItem>{
 val items=mutableListOf(RoleMenuItem("Dashboard"))
 if(data.capabilities.canManageEmployees)items+=RoleMenuItem("Employees")
 items+=listOf(RoleMenuItem("Attendance"),RoleMenuItem("Customers"),RoleMenuItem("Leads"),RoleMenuItem("Follow-ups"),RoleMenuItem("Targets"))
 if(data.capabilities.canAccessSalesBilling)items+=RoleMenuItem("Billing & Subscription")
 if(data.capabilities.canManageSalesSettings)items+=RoleMenuItem("Settings")
 items+=RoleMenuItem("Reports")
 return items
}
private fun roleReportItems(role:MobileRole)=if(role==MobileRole.MANAGER) listOf("Check-in Report" to "check-ins","Attendance Report" to "attendance","GPS Route Report" to "gps","Geofence Report" to "geofence","Target Analysis" to "targets") else listOf("Check-in Report" to "check-ins","Attendance Report" to "attendance","GPS Route Report" to "gps","Geofence Report" to "geofence","Target Analysis" to "targets","Expense Report" to "expenses")

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AdminManagerAuthenticatedApp(data:Bootstrap,message:String?,dismiss:()->Unit,logout:()->Unit,switchToAccount:(()->Unit)?=null){
 val role=data.user.salesRole?:return;val drawer=rememberDrawerState(DrawerValue.Closed);val scope=rememberCoroutineScope();var route by rememberSaveable(role){mutableStateOf("Dashboard")};var reportOpen by rememberSaveable{mutableStateOf(false)};var reportType by rememberSaveable{mutableStateOf<String?>(null)};var profileMenu by remember{mutableStateOf(false)}
 fun navigate(value:String){route=value;reportType=null;scope.launch{drawer.close()}}
 ModalNavigationDrawer(drawerState=drawer,drawerContent={ModalDrawerSheet(Modifier.width(300.dp),drawerContainerColor=SalesNavy){Spacer(Modifier.height(22.dp));roleMenu(data).forEach{item->if(item.label=="Reports"){NavigationDrawerItem(label={Text("Reports",fontWeight=FontWeight.SemiBold)},selected=route=="Reports",onClick={reportOpen=!reportOpen},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent,selectedContainerColor=Color.White.copy(alpha=.12f),unselectedTextColor=Color.White,selectedTextColor=Color.White),modifier=Modifier.padding(horizontal=12.dp,vertical=2.dp));if(reportOpen)roleReportItems(role).forEach{(label,type)->TextButton({route="Reports";reportType=type;scope.launch{drawer.close()}},Modifier.fillMaxWidth().padding(start=34.dp)){Text(label,Modifier.fillMaxWidth(),color=Color.White)}}}else NavigationDrawerItem(label={Text(item.label,fontWeight=FontWeight.SemiBold)},selected=route==item.label,onClick={navigate(item.label)},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent,selectedContainerColor=Color.White.copy(alpha=.12f),unselectedTextColor=Color.White,selectedTextColor=Color.White),modifier=Modifier.padding(horizontal=12.dp,vertical=2.dp))};if(switchToAccount!=null){HorizontalDivider(Modifier.padding(16.dp),color=Color.White.copy(alpha=.18f));NavigationDrawerItem(label={Text("⇄  Switch to Accounts",color=Color.White)},selected=false,onClick={scope.launch{drawer.close()};switchToAccount()},colors=NavigationDrawerItemDefaults.colors(unselectedContainerColor=Color.Transparent),modifier=Modifier.padding(horizontal=12.dp))}}}){
  Scaffold(containerColor=SalesPale,topBar={TopAppBar(colors=TopAppBarDefaults.topAppBarColors(containerColor=Color.White),navigationIcon={IconButton({scope.launch{drawer.open()}}){Icon(Icons.Default.Menu,"Open menu")}},title={CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)},actions={Box{IconButton({profileMenu=true}){Surface(shape=CircleShape,color=Color(0xFFEAF3FF)){Box(Modifier.size(42.dp),contentAlignment=Alignment.Center){Text(data.user.name.trim().firstOrNull()?.uppercase()?:"U",color=SalesBlue,fontWeight=FontWeight.Bold)}}};DropdownMenu(profileMenu,{profileMenu=false}){DropdownMenuItem({Text("Company Details")},{profileMenu=false;route="Company Details"});DropdownMenuItem({Text("Follow-up Tasks")},{profileMenu=false;route="Follow-ups"});DropdownMenuItem({Text("Change Password")},{profileMenu=false;route="Change Password"});HorizontalDivider();DropdownMenuItem({Text("Logout")},{profileMenu=false;logout()})}}}})}){padding->Column(Modifier.padding(padding).fillMaxSize()){message?.let{MessageBanner(it,dismiss)};when(route){"Dashboard"->RoleDashboard(data);"Employees"->EmployeesScreen();"Attendance"->ReportsScreen(initialType="attendance",showMenu=false,role=role);"Customers"->CustomersScreen();"Leads"->LeadsScreen();"Follow-ups"->FollowUpsScreen(startCheckIn={},viewLead={});"Targets"->TargetsScreen(role);"Billing & Subscription"->SubscriptionScreen();"Settings"->SettingsScreen();"Reports"->ReportsScreen(initialType=reportType,showMenu=reportType==null,role=role);"Company Details"->RoleCompanyDetails(data);"Change Password"->ChangePasswordScreen();else->RoleDashboard(data)}}}
 }
}

@Composable private fun RoleDashboard(data:Bootstrap){val dash=data.adminDashboard;val label=when{data.user.salesRole==MobileRole.ADMIN->"ADDITIONAL ADMIN";data.user.managerType=="MANAGER_ONLY"->"OFFICE MANAGER";else->"SALES MANAGER"};LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text(label,style=MaterialTheme.typography.labelLarge,color=SalesBlue,fontWeight=FontWeight.Bold);Text("Good day, ${data.user.name.substringBefore(' ')}!",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold,color=SalesInk);Text(if(data.user.salesRole==MobileRole.MANAGER)"Your assigned team overview." else "Your company field-team overview.",color=SalesMuted)};item{Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){RoleMetric("Team members",dash?.teamMemberCount,Modifier.weight(1f));RoleMetric("Present today",dash?.presentToday,Modifier.weight(1f))};Spacer(Modifier.height(10.dp));Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){RoleMetric("Check-ins today",dash?.todayVisitCount,Modifier.weight(1f));RoleMetric("Leads today",dash?.todayLeadCount,Modifier.weight(1f))}};item{ContentCard("Check-in Activity",if(dash?.recentVisits.isNullOrEmpty())"No completed check-ins yet." else "${dash?.recentVisits?.size} recent completed check-ins available.")};item{ContentCard("Live Tracking",if(data.features.gpsTrackingEnabled)"View authorized field-team locations from the tracking report." else "GPS tracking is disabled in company settings.")}}}
@Composable private fun RoleMetric(label:String,value:Int?,modifier:Modifier){Card(modifier,colors=CardDefaults.cardColors(containerColor=Color.White)){Column(Modifier.padding(14.dp)){Text(label,color=SalesMuted);Text(value?.toString()?:"—",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold,color=SalesInk)}}}
@Composable private fun RoleCompanyDetails(data:Bootstrap){Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("Company Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard(data.company.name,data.company.address?:"Company address is not available."){CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)}}}
