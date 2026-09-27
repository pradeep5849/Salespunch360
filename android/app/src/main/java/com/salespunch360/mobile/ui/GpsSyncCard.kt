package com.salespunch360.mobile.ui

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.salespunch360.mobile.SalesPunchApp
import com.salespunch360.mobile.location.LocationSyncWorker
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun connectivity(context:Context)=callbackFlow {
 val manager=context.getSystemService(ConnectivityManager::class.java)
 fun send(){trySend(manager.getNetworkCapabilities(manager.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)==true)}
 val callback=object:ConnectivityManager.NetworkCallback(){
  override fun onAvailable(network:Network){send()}
  override fun onLost(network:Network){send()}
  override fun onCapabilitiesChanged(network:Network,capabilities:NetworkCapabilities){send()}
 }
 manager.registerDefaultNetworkCallback(callback);send()
 awaitClose{manager.unregisterNetworkCallback(callback)}
}.distinctUntilChanged()

@Composable fun GpsSyncCard(owner:String,enabled:Boolean){
 val context=LocalContext.current.applicationContext
 val dao=(context as SalesPunchApp).database.locations()
 val pending by remember(owner){dao.count(owner)}.collectAsStateWithLifecycle(0)
 val status by remember(owner){dao.status(owner)}.collectAsStateWithLifecycle(null)
 val manager=remember{WorkManager.getInstance(context)}
 val work by remember(owner){manager.getWorkInfosForUniqueWorkFlow("location-sync-$owner")}.collectAsStateWithLifecycle(emptyList())
 val recovery by remember(owner){manager.getWorkInfosForUniqueWorkFlow("location-recovery-$owner")}.collectAsStateWithLifecycle(emptyList())
 val online by remember{connectivity(context)}.collectAsStateWithLifecycle(false)
 val running=(work+recovery).any{it.state==WorkInfo.State.RUNNING}
 val label=when{!enabled->"GPS uploads paused by company settings";running->"Uploading GPS points…";pending==0->"All queued points uploaded";!online->"Waiting for internet";else->"Waiting to upload"}
 val uploaded=status?.lastSuccessAt?.let{runCatching{DateTimeFormatter.ofPattern("d MMM, h:mm a").withZone(ZoneId.systemDefault()).format(Instant.parse(it))}.getOrDefault(it)}?:"Not yet"
 Card(Modifier.fillMaxWidth()){
  Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
   Text("GPS sync",style=MaterialTheme.typography.titleMedium)
   Text("Pending: $pending · $label")
   Text("Last successful upload: $uploaded",style=MaterialTheme.typography.bodySmall)
   status?.takeIf{it.discardedCount>0}?.let{Text("${it.discardedCount} points could not be kept or accepted (expired, outside attendance or queue limit).",style=MaterialTheme.typography.bodySmall)}
   if(status?.lastIssue=="ACCESS_CHANGED")Text("Your access changed. Refresh your account before retrying.")
   OutlinedButton({LocationSyncWorker.schedule(context,owner,retryNow=true)},enabled=enabled&&online&&pending>0&&!running){Text("Retry sync")}
  }
 }
}
