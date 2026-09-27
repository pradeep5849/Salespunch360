package com.salespunch360.mobile.location

import android.content.Context
import androidx.work.*
import com.salespunch360.mobile.SalesPunchApp
import com.salespunch360.mobile.data.*
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class LocationSyncWorker(context:Context,params:WorkerParameters):CoroutineWorker(context,params){
 override suspend fun doWork():Result=uploadLock.withLock{
  val dao=(applicationContext as SalesPunchApp).database.locations()
  val session=SecureSession(applicationContext)
  val owner=inputData.getString("owner_user_id")?:return@withLock Result.failure()
  val token=session.token()?:return@withLock Result.failure()
  if(session.userId()!=owner)return@withLock Result.failure()
  val api=ApiClient(session,token)
  dao.ensureStatus(LocationSyncStatus(owner))
  try{
   val complete=LocationSyncEngine(
    nextBatch={dao.batch(owner)},
    upload={points->api.uploadLocations(points.map{LocationPayload(it.latitude,it.longitude,it.accuracy,it.id,it.capturedAt)})},
    acknowledge={point,at->dao.acknowledge(point,at)},discard={point,reason->dao.discard(point,reason)},
    currentOwner={session.userId()==owner&&session.token()==token},
   ).drain()
   if(complete)Result.success() else Result.retry()
  }catch(error:CancellationException){throw error}
  catch(error:ApiException){
   if(session.userId()!=owner||session.token()!=token)return@withLock Result.failure()
   when{
    error.status==401->{session.invalidateIfCurrent(token);Result.failure()}
    error.status==403->{dao.setIssue(owner,"ACCESS_CHANGED");session.authorizationChanged();TrackingService.stop(applicationContext);Result.failure()}
    error.code=="GPS_DISABLED"->{dao.setIssue(owner,"GPS_DISABLED");TrackingService.stop(applicationContext);Result.failure()}
    else->Result.retry()
   }
  }catch(_:Exception){Result.retry()}
 }
 companion object{
  private val uploadLock=Mutex()
  private fun request(owner:String)=OneTimeWorkRequestBuilder<LocationSyncWorker>().setInputData(workDataOf("owner_user_id" to owner)).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,TimeUnit.SECONDS).build()
  fun schedule(context:Context,ownerUserId:String,retryNow:Boolean=false){
   val manager=WorkManager.getInstance(context)
   manager.enqueueUniqueWork("location-sync-$ownerUserId",if(retryNow)ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,request(ownerUserId))
   manager.enqueueUniquePeriodicWork("location-recovery-$ownerUserId",ExistingPeriodicWorkPolicy.KEEP,PeriodicWorkRequestBuilder<LocationSyncWorker>(15,TimeUnit.MINUTES).setInputData(workDataOf("owner_user_id" to ownerUserId)).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
  }
  fun cancel(context:Context,owner:String){val manager=WorkManager.getInstance(context);manager.cancelUniqueWork("location-sync-$owner");manager.cancelUniqueWork("location-recovery-$owner")}
 }
}
