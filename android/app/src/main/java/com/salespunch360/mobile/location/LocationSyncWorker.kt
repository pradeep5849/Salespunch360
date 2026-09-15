package com.salespunch360.mobile.location
import android.content.Context
import androidx.work.*
import com.salespunch360.mobile.SalesPunchApp
import com.salespunch360.mobile.data.*

class LocationSyncWorker(context:Context,params:WorkerParameters):CoroutineWorker(context,params){
 override suspend fun doWork():Result{
  val app=applicationContext as SalesPunchApp
  val locationDao=app.database.locations()
  val session=SecureSession(applicationContext)
  val owner=inputData.getString("owner_user_id")?:return Result.failure()
  if(session.token()==null||session.userId()!=owner){
   locationDao.clearOwner(owner)
   return Result.failure()
  }
  val api=ApiClient(session)
  return try{
   for(point in locationDao.batch(owner)){
    api.upload(LocationPayload(point.latitude,point.longitude,point.accuracy,point.id,point.capturedAt))
    locationDao.delete(point.id,owner)
   }
   Result.success()
  }catch(error:ApiException){
   when(error.status){
    401->{
     locationDao.clearOwner(owner)
     session.invalidate()
     TrackingService.stop(applicationContext)
     Result.failure()
    }
    403->{
     session.authorizationChanged()
     TrackingService.stop(applicationContext)
     Result.failure()
    }
    else->Result.retry()
   }
  }catch(_:Exception){
   Result.retry()
  }
 }

 companion object{
  fun schedule(context:Context,ownerUserId:String)=WorkManager.getInstance(context).enqueueUniqueWork(
   "location-sync-$ownerUserId",
   ExistingWorkPolicy.KEEP,
   OneTimeWorkRequestBuilder<LocationSyncWorker>()
    .setInputData(workDataOf("owner_user_id" to ownerUserId))
    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,java.util.concurrent.TimeUnit.SECONDS)
    .build()
  )
 }
}
