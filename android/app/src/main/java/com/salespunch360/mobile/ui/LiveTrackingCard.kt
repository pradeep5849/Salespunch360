package com.salespunch360.mobile.ui

import android.content.Intent
import android.location.Geocoder
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.DashboardViewModel
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

@Suppress("DEPRECATION")
private suspend fun trackingAddress(
    context: android.content.Context,
    latitude: Double,
    longitude: Double,
): String? = withContext(Dispatchers.IO) {
    runCatching {
        if (!Geocoder.isPresent()) return@runCatching null
        Geocoder(context, Locale.getDefault()).getFromLocation(latitude, longitude, 1)
            ?.firstOrNull()
            ?.getAddressLine(0)
    }.getOrNull()
}

@Composable
fun LiveTrackingCard(vm: DashboardViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    var expanded by remember { mutableStateOf(false) }
    val context = LocalContext.current

    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(state.selectedEmployeeId, state.gpsTrackingEnabled) {
        if (state.selectedEmployeeId != null && state.gpsTrackingEnabled != false) {
            vm.view()
            while (true) {
                delay(30_000)
                vm.view(silent = true)
            }
        }
    }

    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White),
        border = BorderStroke(1.dp, SalesLine),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Live Track", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = SalesInk)
                StatusChip(
                    if (state.gpsTrackingEnabled == true) "GPS Enabled"
                    else if (state.gpsTrackingEnabled == false) "GPS Disabled"
                    else "Checking",
                )
            }
            if (state.gpsTrackingEnabled == false) {
                Text("GPS tracking is disabled in Company Settings.", color = SalesMuted, style = MaterialTheme.typography.bodySmall)
                return@Column
            }

            Box(Modifier.fillMaxWidth()) {
                OutlinedButton({ expanded = true }, Modifier.fillMaxWidth()) {
                    Text(state.employees.firstOrNull { it.id == state.selectedEmployeeId }?.name ?: "Select employee")
                }
                DropdownMenu(expanded, { expanded = false }) {
                    state.employees.forEach { employee ->
                        DropdownMenuItem(
                            text = { Text(employee.name) },
                            onClick = {
                                expanded = false
                                vm.select(employee.id)
                            },
                        )
                    }
                }
            }

            state.message?.let { Text(it, color = SalesMuted, style = MaterialTheme.typography.bodySmall) }
            state.latestLocation?.let { location ->
                var address by remember(location.latitude, location.longitude) { mutableStateOf<String?>(null) }
                var resolving by remember(location.latitude, location.longitude) { mutableStateOf(true) }
                LaunchedEffect(location.latitude, location.longitude) {
                    resolving = true
                    address = trackingAddress(context, location.latitude, location.longitude)
                    resolving = false
                }

                NativeMap(
                    emptyList(),
                    listOf(
                        NativeMapPoint(
                            location.latitude,
                            location.longitude,
                            location.user.name,
                            "Last spotted at ${trackingClock(location.capturedAt)} · As per GPS",
                            showInfo = true,
                        ),
                    ),
                    Modifier.fillMaxWidth().height(380.dp),
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(location.user.name, fontWeight = FontWeight.SemiBold, color = SalesInk)
                        Text("Last spotted at ${trackingClock(location.capturedAt)}", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
                        Text(if (resolving) "Finding address…" else address ?: "Address unavailable", style = MaterialTheme.typography.bodySmall, color = SalesMuted)
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton({ vm.view() }, enabled = !state.loading, modifier = Modifier.weight(1f)) {
                        Text(if (state.loading) "Refreshing…" else "Refresh")
                    }
                    OutlinedButton(
                        {
                            val uri = Uri.parse("geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}")
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                        },
                        modifier = Modifier.weight(1f),
                    ) { Text("Open Map") }
                }
            }
            if (state.latestLocation == null && state.loading) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
    }
}

private fun trackingClock(value: String) = runCatching {
    java.time.OffsetDateTime.parse(value)
        .atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata"))
        .format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
}.getOrDefault(value)
