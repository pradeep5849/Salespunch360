package com.salespunch360.mobile.location
import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.salespunch360.mobile.SalesPunchApp
import com.salespunch360.mobile.data.LocationQueue
import com.salespunch360.mobile.data.PendingLocation
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.R
import kotlinx.coroutines.*
import java.time.Instant
import java.util.UUID
class TrackingService:Service(){private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO);private lateinit var fused:FusedLocationProviderClient;private val callback=object:LocationCallback(){override fun onLocationResult(result:LocationResult){val owner=SecureSession(this@TrackingService).userId()?:run{stopSelf();return};result.locations.forEach{location->if(location.accuracy<=100f)scope.launch{LocationQueue((application as SalesPunchApp).database.locations()).enqueue(PendingLocation(UUID.randomUUID().toString(),owner,location.latitude,location.longitude,location.accuracy.toDouble(),Instant.ofEpochMilli(location.time).toString()));LocationSyncWorker.schedule(this@TrackingService,owner)}}}}
 override fun onCreate(){super.onCreate();createChannel();startForeground(42,notification("Location updates are active"));fused=LocationServices.getFusedLocationProviderClient(this)}
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{if(ActivityCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){stopSelf();return START_NOT_STICKY};val request=LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY,30_000).setMinUpdateDistanceMeters(25f).setMinUpdateIntervalMillis(15_000).build();fused.requestLocationUpdates(request,callback,mainLooper);return START_NOT_STICKY}
 override fun onDestroy(){fused.removeLocationUpdates(callback);scope.cancel();super.onDestroy()};override fun onBind(intent:Intent?):IBinder?=null
 private fun createChannel(){(getSystemService(NOTIFICATION_SERVICE)as NotificationManager).createNotificationChannel(NotificationChannel("tracking","Attendance location tracking",NotificationManager.IMPORTANCE_LOW).apply{description="Visible while company-authorized attendance GPS tracking is active"})};private fun notification(text:String)=NotificationCompat.Builder(this,"tracking").setContentTitle("Attendance location tracking").setContentText(text).setSmallIcon(R.drawable.ic_sp360_foreground).setOngoing(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setOnlyAlertOnce(true).build()
 companion object{fun start(context:Context)=ContextCompat.startForegroundService(context,Intent(context,TrackingService::class.java));fun stop(context:Context)=context.stopService(Intent(context,TrackingService::class.java))}}
