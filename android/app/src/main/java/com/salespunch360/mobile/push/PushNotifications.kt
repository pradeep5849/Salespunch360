package com.salespunch360.mobile.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.salespunch360.mobile.R
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object PushNotifications {
 const val CHANNEL_ID="field_activity"
 fun ensureChannel(context:Context){if(Build.VERSION.SDK_INT>=26)context.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL_ID,"Field activity",NotificationManager.IMPORTANCE_DEFAULT))}
 fun installationId(context:Context):String { val prefs=context.getSharedPreferences("installation",Context.MODE_PRIVATE);return prefs.getString("id",null)?:UUID.randomUUID().toString().also{prefs.edit().putString("id",it).apply()} }
 fun register(context:Context){if(SecureSession(context).token()==null||FirebaseApp.getApps(context).isEmpty())return;FirebaseMessaging.getInstance().token.addOnSuccessListener{token->CoroutineScope(Dispatchers.IO).launch{runCatching{ApiClient(SecureSession(context)).registerPush(installationId(context),token)}}}}
 fun show(context:Context,title:String?,body:String?){if(body.isNullOrBlank())return;ensureChannel(context);if(Build.VERSION.SDK_INT<33||ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)NotificationManagerCompat.from(context).notify((System.currentTimeMillis()%Int.MAX_VALUE).toInt(),NotificationCompat.Builder(context,CHANNEL_ID).setSmallIcon(R.drawable.ic_sp360_badge).setContentTitle(title?:"SalesPunch360 field activity").setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).build())}
}
class FieldMessagingService:FirebaseMessagingService(){override fun onNewToken(token:String){CoroutineScope(Dispatchers.IO).launch{runCatching{ApiClient(SecureSession(this@FieldMessagingService)).registerPush(PushNotifications.installationId(this@FieldMessagingService),token)}}};override fun onMessageReceived(message:RemoteMessage){PushNotifications.show(this,message.notification?.title?:message.data["title"],message.notification?.body?:message.data["body"])}}
