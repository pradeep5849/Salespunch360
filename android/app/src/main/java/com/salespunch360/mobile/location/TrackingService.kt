package com.salespunch360.mobile.location

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.salespunch360.mobile.R
import com.salespunch360.mobile.SalesPunchApp
import com.salespunch360.mobile.data.LocationQueue
import com.salespunch360.mobile.data.PendingLocation
import com.salespunch360.mobile.data.SecureSession
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class TrackingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fused: FusedLocationProviderClient
    private var requestingUpdates = false
    private var foregroundReady = false
    private var stationaryFixes = 0
    private var stationaryMode = false
    private var suspiciousMode = false
    private var suspiciousFixesRemaining = 0
    private var previousFix: android.location.Location? = null

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            if (!isAttendanceTrackingAuthorized(this@TrackingService)) {
                stopSelf()
                return
            }
            val owner = SecureSession(this@TrackingService).userId() ?: run {
                stopSelf()
                return
            }
            result.locations.forEach { location ->
                val previous = previousFix
                val elapsedSeconds = if (previous != null) (location.elapsedRealtimeNanos - previous.elapsedRealtimeNanos) / 1_000_000_000.0 else 0.0
                val suspicious = previous != null && elapsedSeconds > 0 && elapsedSeconds <= 120 &&
                    location.distanceTo(previous) / elapsedSeconds > 100.0 / 3.6
                if (suspicious) suspiciousFixesRemaining = 3
                else if (suspiciousFixesRemaining > 0) suspiciousFixesRemaining--
                val nextSuspiciousMode = suspiciousFixesRemaining > 0
                val oldStationaryMode = stationaryMode
                if (location.accuracy <= 30f) {
                    val stationary = previous != null && location.distanceTo(previous) <= 10f && (!location.hasSpeed() || location.speed < 0.5f)
                    stationaryFixes = if (stationary) stationaryFixes + 1 else 0
                    previousFix = location
                    val desired = stationaryFixes >= 4
                    stationaryMode = desired
                } else {
                    // A coarse balanced-power fix must not trap tracking in stationary mode.
                    stationaryFixes = 0
                    stationaryMode = false
                }
                if (nextSuspiciousMode) stationaryMode = false
                if (oldStationaryMode != stationaryMode || suspiciousMode != nextSuspiciousMode) {
                    suspiciousMode = nextSuspiciousMode
                    refreshLocationRequest()
                }
                if (location.accuracy <= 100f && isAttendanceTrackingAuthorized(this@TrackingService)) {
                    scope.launch {
                        LocationQueue((application as SalesPunchApp).database.locations()).enqueue(
                            PendingLocation(
                                UUID.randomUUID().toString(),
                                owner,
                                location.latitude,
                                location.longitude,
                                location.accuracy.toDouble(),
                                Instant.ofEpochMilli(location.time).toString(),
                            ),
                        )
                        LocationSyncWorker.schedule(this@TrackingService, owner)
                    }
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        foregroundReady = runCatching {
            createChannel()
            startForeground(42, notification("Location updates are active while attendance is ON"))
            true
        }.getOrDefault(false)
        if (!foregroundReady) {
            stopSelf()
            return
        }
        fused = LocationServices.getFusedLocationProviderClient(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!foregroundReady || !::fused.isInitialized) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!isAttendanceTrackingAuthorized(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            setAttendanceTrackingAuthorized(this, false)
            stopSelf()
            return START_NOT_STICKY
        }
        if (SecureSession(this).userId() == null) {
            setAttendanceTrackingAuthorized(this, false)
            stopSelf()
            return START_NOT_STICKY
        }
        if (requestingUpdates) return START_STICKY

        val request = locationRequest()
        return try {
            fused.requestLocationUpdates(request, callback, mainLooper)
            requestingUpdates = true
            START_STICKY
        } catch (_: SecurityException) {
            setAttendanceTrackingAuthorized(this, false)
            stopSelf()
            START_NOT_STICKY
        } catch (_: IllegalStateException) {
            stopSelf()
            START_NOT_STICKY
        }
    }

    private fun locationRequest(): LocationRequest =
        LocationRequest.Builder(
            if (stationaryMode) Priority.PRIORITY_BALANCED_POWER_ACCURACY else Priority.PRIORITY_HIGH_ACCURACY,
            if (suspiciousMode) 10_000L else if (stationaryMode) 60_000L else 15_000L,
        )
            .setMinUpdateDistanceMeters(if (stationaryMode || suspiciousMode) 0f else 10f)
            .setMinUpdateIntervalMillis(if (suspiciousMode) 10_000L else if (stationaryMode) 60_000L else 15_000L)
            .build()

    private fun refreshLocationRequest() {
        if (!requestingUpdates || !isAttendanceTrackingAuthorized(this)) return
        try {
            fused.requestLocationUpdates(locationRequest(), callback, mainLooper)
                .addOnFailureListener { stopSelf() }
        } catch (_: SecurityException) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        if (::fused.isInitialized) runCatching { fused.removeLocationUpdates(callback) }
        requestingUpdates = false
        foregroundReady = false
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
            NotificationChannel(
                "tracking",
                "Attendance location tracking",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Visible only while company-authorized attendance GPS tracking is active"
            },
        )
    }

    private fun notification(text: String) = NotificationCompat.Builder(this, "tracking")
        .setContentTitle("Attendance location tracking")
        .setContentText(text)
        .setSmallIcon(R.drawable.ic_sp360_foreground)
        .setOngoing(true)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setOnlyAlertOnce(true)
        .build()

    companion object {
        private const val PREFS = "attendance_gps_tracking"
        private const val KEY_AUTHORIZED = "attendance_active"

        fun isAttendanceTrackingAuthorized(context: Context): Boolean =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_AUTHORIZED, false)

        private fun setAttendanceTrackingAuthorized(context: Context, active: Boolean) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_AUTHORIZED, active)
                .apply()
        }

        fun start(context: Context): Boolean {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                setAttendanceTrackingAuthorized(context, false)
                return false
            }
            setAttendanceTrackingAuthorized(context, true)
            return runCatching {
                ContextCompat.startForegroundService(context, Intent(context, TrackingService::class.java))
                true
            }.getOrElse {
                setAttendanceTrackingAuthorized(context, false)
                false
            }
        }

        fun stop(context: Context): Boolean {
            setAttendanceTrackingAuthorized(context, false)
            return runCatching {
                context.stopService(Intent(context, TrackingService::class.java))
            }.getOrDefault(false)
        }
    }
}
