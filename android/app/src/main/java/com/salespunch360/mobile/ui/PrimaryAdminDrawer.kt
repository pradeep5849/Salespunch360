package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

private val PrimaryAdminItems = listOf(
    "Dashboard", "Employees", "Attendance", "Customers", "Leads", "Follow-ups", "Targets",
    "Billing & Subscription", "Settings", "Reports"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrimaryAdminAuthenticatedApp(
    data: Bootstrap,
    message: String?,
    dismiss: () -> Unit,
    logout: () -> Unit,
    switchToAccount: (() -> Unit)? = null
) {
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var route by rememberSaveable { mutableStateOf("Dashboard") }
    var profileMenu by remember { mutableStateOf(false) }
    fun navigate(value: String) { route = value; scope.launch { drawer.close() } }

    ModalNavigationDrawer(
        drawerState = drawer,
        drawerContent = {
            ModalDrawerSheet(Modifier.width(300.dp), drawerContainerColor = SalesNavy) {
                Spacer(Modifier.height(22.dp))
                PrimaryAdminItems.forEach { item ->
                    NavigationDrawerItem(
                        label = { Text(item, fontWeight = FontWeight.SemiBold) },
                        selected = route == item,
                        onClick = { navigate(item) },
                        colors = NavigationDrawerItemDefaults.colors(
                            unselectedContainerColor = Color.Transparent,
                            selectedContainerColor = Color.White.copy(alpha = .12f),
                            unselectedTextColor = Color.White,
                            selectedTextColor = Color.White
                        ),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp)
                    )
                }
                if (switchToAccount != null) {
                    HorizontalDivider(Modifier.padding(16.dp), color = Color.White.copy(alpha = .18f))
                    NavigationDrawerItem(
                        label = { Text("⇄  Switch to Accounts", color = Color.White) },
                        selected = false,
                        onClick = { scope.launch { drawer.close() }; switchToAccount() },
                        colors = NavigationDrawerItemDefaults.colors(unselectedContainerColor = Color.Transparent),
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }
            }
        }
    ) {
        Scaffold(
            containerColor = SalesPale,
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White),
                    navigationIcon = { IconButton({ scope.launch { drawer.open() } }) { Icon(Icons.Default.Menu, "Open menu") } },
                    title = { CompanyIdentity(data.company.name, data.company.address, data.company.logoUrl) },
                    actions = {
                        Box {
                            IconButton({ profileMenu = true }) {
                                Surface(shape = CircleShape, color = Color(0xFFEAF3FF)) {
                                    Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) {
                                        Text(data.user.name.trim().firstOrNull()?.uppercase() ?: "P", color = SalesBlue, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                            DropdownMenu(profileMenu, { profileMenu = false }) {
                                DropdownMenuItem({ Text("Company Details") }, { profileMenu = false; route = "Company Details" })
                                DropdownMenuItem({ Text("Follow-up Tasks") }, { profileMenu = false; route = "Follow-ups" })
                                DropdownMenuItem({ Text("Change Password") }, { profileMenu = false; route = "Change Password" })
                                HorizontalDivider()
                                DropdownMenuItem({ Text("Logout") }, { profileMenu = false; logout() })
                            }
                        }
                    }
                )
            }
        ) { padding ->
            Column(Modifier.padding(padding).fillMaxSize()) {
                message?.let { MessageBanner(it, dismiss) }
                when (route) {
                    "Dashboard" -> PrimaryAdminDashboard(data)
                    "Employees" -> EmployeesScreen()
                    "Customers" -> CustomersScreen()
                    "Leads" -> LeadsScreen()
                    "Follow-ups" -> FollowUpsScreen(startCheckIn = {}, viewLead = {})
                    "Targets" -> TargetsScreen(MobileRole.PRIMARY_ADMIN)
                    "Billing & Subscription" -> SubscriptionScreen()
                    "Settings" -> SettingsScreen()
                    "Reports" -> ReportsScreen()
                    "Company Details" -> PrimaryAdminCompanyDetails(data)
                    "Change Password" -> ChangePasswordScreen()
                    "Attendance" -> ReportsScreen(initialType = "attendance", showMenu = false)
                    else -> PrimaryAdminDashboard(data)
                }
            }
        }
    }
}

@Composable
private fun PrimaryAdminDashboard(data: Bootstrap) {
    val d = data.adminDashboard
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("PRIMARY ADMIN", style = MaterialTheme.typography.labelLarge, color = SalesBlue, fontWeight = FontWeight.Bold)
            Text("Good day, ${data.user.name.substringBefore(' ')}!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = SalesInk)
            Text("Your company field-team overview.", color = SalesMuted)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryMetric("Team members", d?.teamMemberCount, "Real company data", Modifier.weight(1f))
                PrimaryMetric("Present today", d?.presentToday, "Started today", Modifier.weight(1f))
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryMetric("Check-ins today", d?.todayVisitCount, "Field visits", Modifier.weight(1f))
                PrimaryMetric("Leads today", d?.todayLeadCount, "Assigned activity", Modifier.weight(1f))
            }
        }
        item {
            ContentCard("Check-in Activity", if (d?.recentVisits.isNullOrEmpty()) "No completed check-ins match this selection." else "Recent completed check-ins") {
                d?.recentVisits?.forEach { visit ->
                    HorizontalDivider()
                    Text("${visit.userName ?: "Employee"} · ${visit.customerName ?: visit.contactName ?: "Field prospect"}", fontWeight = FontWeight.Bold)
                    visit.checkInAddress?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SalesMuted) }
                    Text(if (visit.checkedOutAt == null) "Checked in" else "Completed${visit.checkoutSentiment?.let { " · $it" } ?: ""}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
                }
            }
        }
        item {
            ContentCard("Live Tracking", "Select an authorized employee to view their latest stored GPS point.")
        }
    }
}

@Composable private fun PrimaryMetric(label:String, value:Int?, note:String, modifier:Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = Color.White), border = androidx.compose.foundation.BorderStroke(1.dp, SalesLine)) {
        Column(Modifier.padding(14.dp)) {
            Text(label, color = SalesMuted)
            Text(value?.toString() ?: "—", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = SalesInk)
            Text(note, style = MaterialTheme.typography.bodySmall, color = SalesMuted)
        }
    }
}

@Composable private fun PrimaryAdminCompanyDetails(data: Bootstrap) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Company Details", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item { ContentCard(data.company.name, data.company.address ?: "Company address is not available.") { CompanyIdentity(data.company.name, data.company.address, data.company.logoUrl) } }
    }
}
