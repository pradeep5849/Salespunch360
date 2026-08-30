package com.salespunch360.mobile.ui

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.location.TrackingService

data class PrimaryDestination(val label:String,val icon:ImageVector)
object RoleNavigation{fun destinations(role:MobileRole)=when(role){MobileRole.COMPANY_ADMIN->listOf(PrimaryDestination("Home",Icons.Default.Home),PrimaryDestination("Employees",Icons.Default.Groups),PrimaryDestination("Reports",Icons.Default.Assessment),PrimaryDestination("More",Icons.Default.MoreHoriz));MobileRole.MANAGER->listOf(PrimaryDestination("Home",Icons.Default.Home),PrimaryDestination("Team",Icons.Default.Groups),PrimaryDestination("Reports",Icons.Default.Assessment),PrimaryDestination("More",Icons.Default.MoreHoriz));MobileRole.SALES->listOf(PrimaryDestination("Home",Icons.Default.Home),PrimaryDestination("Customers",Icons.Default.People),PrimaryDestination("Leads",Icons.Default.FilterAlt),PrimaryDestination("More",Icons.Default.MoreHoriz))}}

@OptIn(ExperimentalMaterial3Api::class) @Composable fun AuthenticatedApp(data:Bootstrap,message:String?,dismiss:()->Unit,attendance:(Boolean,()->Unit)->Unit,logout:()->Unit){
 val destinations=RoleNavigation.destinations(data.user.role);var selected by remember(data.user.role){mutableIntStateOf(0)};BackHandler(selected!=0){selected=0}
 Scaffold(topBar={TopAppBar(title={CompanyIdentity(data.company.name)},actions={StatusChip(data.entitlement.state)})},bottomBar={NavigationBar{destinations.forEachIndexed{i,item->NavigationBarItem(selected=selected==i,onClick={selected=i},icon={Icon(item.icon,item.label)},label={Text(item.label)})}}}){padding->Column(Modifier.padding(padding).fillMaxSize()){message?.let{MessageBanner(it,dismiss)};when{selected==0->HomeScreen(data,attendance);selected==1&&data.user.role==MobileRole.COMPANY_ADMIN->EmployeesScreen();selected==destinations.lastIndex->MoreScreen(data,logout);else->FoundationScreen(destinations[selected].label)}}}
}

@Composable private fun HomeScreen(data:Bootstrap,attendance:(Boolean,()->Unit)->Unit){LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text("Good to see you, ${data.user.name.substringBefore(' ')}",style=MaterialTheme.typography.headlineSmall);Text(homeIntro(data.user.role))};if(data.user.role!=MobileRole.COMPANY_ADMIN)item{AttendanceCard(data,attendance)};if(data.user.role==MobileRole.COMPANY_ADMIN)item{SeatCard(data)};items(homeFoundations(data).size){ContentCard(homeFoundations(data)[it].first,homeFoundations(data)[it].second)}}}
private fun homeIntro(role:MobileRole)=when(role){MobileRole.COMPANY_ADMIN->"Your company overview";MobileRole.MANAGER->"Your assigned team overview";MobileRole.SALES->"Your day at a glance"}
private fun homeFoundations(data:Bootstrap):List<Pair<String,String>> = when(data.user.role){
 MobileRole.COMPANY_ADMIN->listOf("Team status" to if(data.teamStructure==TeamStructure.SALES_ONLY)"Your direct Sales team will appear here." else "Manager and Sales team status will appear here.","Today's activity" to "Attendance, check-ins and leads will appear as activity is recorded.","Quick actions" to "Employee and reporting actions are available from the navigation below.")
 MobileRole.MANAGER->listOf("Assigned team" to "Team attendance and activity will appear here.","Check-ins & follow-ups" to "Customer visits, leads and follow-ups will appear when recorded.","Performance" to "Team performance information will appear when available.")
 MobileRole.SALES->listOf("Today's visits" to "Customer visits and check-ins will appear when recorded.","Leads & follow-ups" to "Your lead activity and upcoming follow-ups will appear here.","Daily progress" to "Your recorded activity will build today's progress.")}

@Composable private fun AttendanceCard(data:Bootstrap,attendance:(Boolean,()->Unit)->Unit){val context=LocalContext.current;val launcher=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){grants->if(grants[Manifest.permission.ACCESS_FINE_LOCATION]==true)attendance(true){if(data.features.gpsTrackingEnabled)TrackingService.start(context)}};ContentCard("Attendance",when{!data.features.attendanceEnabled->"Attendance is disabled by your company.";data.attendance!=null->"Attendance started at ${data.attendance.startedAt}.";else->"Attendance has not been started."}){Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button({launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))},enabled=data.attendance==null&&data.features.attendanceEnabled&&data.entitlement.operationalWritesAllowed){Text("Start attendance")};OutlinedButton({attendance(false){TrackingService.stop(context)}},enabled=data.attendance!=null){Text("End")}}}}
@Composable private fun SeatCard(data:Bootstrap){val e=data.entitlement;ContentCard("Team seats",if(data.teamStructure==TeamStructure.SALES_ONLY)"Sales ${e.salesUsage} of ${e.salesLimit} used" else "Managers ${e.managerUsage} of ${e.managerLimit} · Sales ${e.salesUsage} of ${e.salesLimit}"){StatusChip(if(e.operationalWritesAllowed)"Operational" else "Read only")}}
@Composable private fun FoundationScreen(title:String){Box(Modifier.fillMaxSize().padding(16.dp)){ContentCard(title,"This workspace is ready. Information will appear here when available.")}}
@Composable private fun MoreScreen(data:Bootstrap,logout:()->Unit){Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){ContentCard("Account","${data.user.name} · ${data.user.role.name.replace('_',' ').lowercase().replaceFirstChar{it.uppercase()}} ");OutlinedButton(logout,Modifier.fillMaxWidth()){Icon(Icons.Default.Logout,null);Spacer(Modifier.width(8.dp));Text("Sign out")};Spacer(Modifier.weight(1f));Text("Powered by SalesPunch360",style=MaterialTheme.typography.labelSmall)}}
