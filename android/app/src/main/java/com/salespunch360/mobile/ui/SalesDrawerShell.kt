package com.salespunch360.mobile.ui

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.location.TrackingService
import kotlinx.coroutines.launch

private data class SalesVisitDetails(
    val id: String,
    val subject: String,
    val salesUser: String,
    val checkedInAt: String,
    val checkedOutAt: String?,
    val status: String?
)

@Composable
private fun SalesVisitDetailsScreen(v: SalesVisitDetails, back: () -> Unit) {
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            TextButton(back, contentPadding = PaddingValues(0.dp)) { Text("← Back") }
            Text("Visit Details", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = SalesInk)
            HorizontalDivider(Modifier.padding(top = 8.dp), color = SalesLine)
        }
        item {
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(v.subject, fontWeight = FontWeight.Bold, color = SalesInk)
                    Text("Sales: ${v.salesUser}", color = SalesMuted)
                    Text("Check-in: ${salesVisitTime(v.checkedInAt)}", color = SalesMuted)
                    v.checkedOutAt?.let { Text("Checkout: ${salesVisitTime(it)}", color = SalesMuted) }
                    v.status?.let { StatusChip(it) }
                }
            }
        }
    }
}

private fun salesVisitTime(value: String) = runCatching {
    java.time.OffsetDateTime.parse(value)
        .atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata"))
        .format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))
}.getOrDefault(value)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesDrawerAuthenticatedApp(
    data: Bootstrap,
    message: String?,
    dismiss: () -> Unit,
    attendance: (Boolean, LocationPayload, () -> Unit) -> Unit,
    logout: () -> Unit,
    switchToAccount: (() -> Unit)? = null
) {
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var route by rememberSaveable { mutableStateOf("Dashboard") }
    var pendingTask by remember { mutableStateOf<FollowUpTask?>(null) }
    var pendingLeadId by remember { mutableStateOf<String?>(null) }
    var pendingCheckInLead by remember { mutableStateOf<LeadSummary?>(null) }
    var visitDetails by remember { mutableStateOf<SalesVisitDetails?>(null) }
    var profileMenu by remember { mutableStateOf(false) }

    fun navigate(to: String) {
        route = to
        scope.launch { drawer.close() }
    }

    BackHandler(visitDetails != null) { visitDetails = null }
    BackHandler(visitDetails == null && route != "Dashboard") { route = "Dashboard" }

    ModalNavigationDrawer(
        drawerState = drawer,
        drawerContent = {
            ModalDrawerSheet(Modifier.width(300.dp), drawerContainerColor = SalesNavy) {
                SalesNavigationDrawerContent(route, data.company.name, data.user.name, ::navigate)
            }
        }
    ) {
        Scaffold(
            containerColor = SalesPale,
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White),
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawer.open() } }) {
                            Icon(Icons.Default.Menu, "Open menu")
                        }
                    },
                    title = { CompanyIdentity(data.company.name, data.company.address, data.company.logoUrl) },
                    actions = {
                        switchToAccount?.let { action ->
                            TextButton(onClick = action) { Text("Account", fontWeight = FontWeight.Bold) }
                        }
                        Box {
                            IconButton(onClick = { profileMenu = true }) {
                                Surface(shape = CircleShape, color = SalesNavy) {
                                    Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
                                        Text(
                                            data.user.name.trim().firstOrNull()?.uppercase() ?: "U",
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    }
                                }
                            }
                            DropdownMenu(expanded = profileMenu, onDismissRequest = { profileMenu = false }) {
                                DropdownMenuItem(text = { Text("Company Details") }, onClick = { profileMenu = false; route = "Company Details" })
                                DropdownMenuItem(text = { Text("Change Password") }, onClick = { profileMenu = false; route = "Change Password" })
                                HorizontalDivider()
                                DropdownMenuItem(text = { Text("Logout") }, onClick = { profileMenu = false; logout() })
                            }
                        }
                    }
                )
            }
        ) { padding ->
            Column(Modifier.padding(padding).fillMaxSize()) {
                message?.let { MessageBanner(it, dismiss) }
                when {
                    visitDetails != null -> SalesVisitDetailsScreen(visitDetails!!) { visitDetails = null }
                    route == "Dashboard" -> SalesDrawerHome(data, ::navigate)
                    route == "Attendance" -> SalesDrawerAttendance(data, attendance)
                    route == "Customers" -> CustomersScreen { navigate("Check-ins") }
                    route == "Check-ins" -> FieldScreen(pendingTask, { pendingTask = null }, pendingCheckInLead, { pendingCheckInLead = null }, onViewPipeline = { navigate("Leads") })
                    route == "Leads" -> LeadsScreen(
                        pendingLeadId,
                        { pendingLeadId = null },
                        onCheckIn = { lead -> pendingCheckInLead = lead; navigate("Check-ins") },
                        onPendingVisitDetails = { v ->
                            visitDetails = SalesVisitDetails(v.id, v.contactName ?: v.customerName ?: "Field prospect", v.userName, v.checkedInAt, v.checkedOutAt, if (v.checkedOutAt == null) "Checkout pending" else "Checkout completed")
                        }
                    )
                    route == "Follow-ups" -> FollowUpsScreen(
                        startCheckIn = { pendingTask = it; navigate("Check-ins") },
                        viewLead = { pendingLeadId = it; navigate("Leads") },
                        viewVisit = { task ->
                            visitDetails = SalesVisitDetails(task.completedVisitId ?: task.id, task.subjectName, task.completedVisitUserName ?: task.assignedUserName ?: "—", task.checkedInAt ?: task.createdAt ?: "—", task.checkedOutAt, if (task.checkedOutAt == null) "Checkout pending" else "Checkout completed")
                        }
                    )
                    route == "Targets" -> TargetsScreen(MobileRole.SALES)
                    route.startsWith("Report:") -> ReportsScreen(initialType = route.substringAfter(':'), showMenu = false)
                    route == "Company Details" -> LazyColumn(Modifier.fillMaxSize().padding(16.dp)) {
                        item {
                            Text("Company Details", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(12.dp))
                            ContentCard(data.company.name, data.company.address ?: "Company address is not available.") {
                                CompanyIdentity(data.company.name, data.company.address, data.company.logoUrl)
                                Text("Signed in as ${data.user.name}")
                            }
                        }
                    }
                    route == "Change Password" -> ChangePasswordScreen()
                    else -> SalesDrawerHome(data, ::navigate)
                }
            }
        }
    }
}

@Composable
private fun SalesDrawerHome(data: Bootstrap, navigate: (String) -> Unit) {
    val d = data.salesDashboard
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("SALES", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = SalesBlue)
            Text("Good day, ${data.user.name.substringBefore(' ')}!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Your field-work overview.", color = SalesMuted)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SalesDrawerMetric("Check-ins This Month", d?.monthVisitCount, Modifier.weight(1f))
                SalesDrawerMetric("Leads This Month", d?.monthLeadCount, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SalesDrawerMetric("Check-ins Today", d?.todayVisitCount, Modifier.weight(1f))
                SalesDrawerMetric("Leads Today", d?.todayLeadCount, Modifier.weight(1f))
            }
        }
        item {
            ContentCard("My Recent Check-ins", if (d?.recentVisits.isNullOrEmpty()) "No completed check-ins yet." else "Your latest completed field visits.") {
                d?.recentVisits?.take(4)?.forEach { v ->
                    HorizontalDivider()
                    Text(v.customerName ?: v.contactName ?: "Field prospect", fontWeight = FontWeight.Bold)
                    v.checkInAddress?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SalesMuted) }
                    Text("Completed${v.checkoutSentiment?.let { " · $it" } ?: ""}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
                }
                TextButton(onClick = { navigate("Check-ins") }) { Text("View All") }
            }
        }
        item {
            ContentCard("My Follow-ups", "Keep today's pending and overdue follow-ups visible.") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SalesDrawerMetric("Pending Today", d?.pendingTodayTasks, Modifier.weight(1f))
                    SalesDrawerMetric("Overdue", d?.overdueTasks, Modifier.weight(1f))
                }
                TextButton(onClick = { navigate("Follow-ups") }) { Text("Open follow-ups") }
            }
        }
    }
}

@Composable
private fun SalesDrawerMetric(label: String, value: Int?, modifier: Modifier) {
    Card(modifier, border = BorderStroke(1.dp, SalesLine), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(12.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = SalesMuted)
            Text(value?.toString() ?: "—", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SalesDrawerAttendance(
    data: Bootstrap,
    attendance: (Boolean, LocationPayload, () -> Unit) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var locating by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }

    fun submit(start: Boolean) {
        scope.launch {
            locating = true
            status = "Getting current location…"
            try {
                val point = com.salespunch360.mobile.location.currentDeviceLocation(context)
                attendance(start, point) {
                    if (start && data.features.gpsTrackingEnabled) TrackingService.start(context)
                    if (!start) TrackingService.stop(context)
                }
                status = "Location ready"
            } catch (e: Exception) {
                status = com.salespunch360.mobile.location.locationFailureMessage(e)
            } finally {
                locating = false
            }
        }
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
            submit(data.attendance == null)
        } else {
            status = "Precise location permission is required."
        }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("Attendance", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            HorizontalDivider(Modifier.padding(top = 8.dp))
        }
        item {
            val active = data.attendance
            if (active != null) {
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF7F7)),
                    border = BorderStroke(1.dp, Color(0xFFE25A5A))
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("ON ATTENDANCE", fontWeight = FontWeight.Bold, color = Color(0xFFC62828))
                        Text("Started ${salesDrawerTime(active.startedAt)}")
                        if (data.features.gpsTrackingEnabled) {
                            val pointLabel = if (active.gpsPointCount == 1) "point" else "points"
                            Text("GPS tracking active · ${active.gpsPointCount} $pointLabel", color = SalesMuted)
                        }
                        status?.let { Text(it, color = SalesMuted) }
                        Button(
                            onClick = { launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
                            enabled = !locating,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828))
                        ) { Text(if (locating) "Locating…" else "End Attendance") }
                    }
                }
            } else {
                ContentCard("Attendance", if (data.features.attendanceEnabled) "Not currently working" else "Attendance is disabled by your company.") {
                    status?.let { Text(it, color = SalesMuted) }
                    Button(
                        onClick = { launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
                        enabled = !locating && data.features.attendanceEnabled && data.entitlement.operationalWritesAllowed,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(if (locating) "Locating…" else "Start Attendance") }
                }
            }
        }
    }
}

private fun salesDrawerTime(value: String) = runCatching {
    java.time.OffsetDateTime.parse(value)
        .atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata"))
        .format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
}.getOrDefault(value)
