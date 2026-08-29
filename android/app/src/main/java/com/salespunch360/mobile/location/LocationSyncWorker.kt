package com.salespunch360.mobile.location
import android.content.Context
import androidx.work.*
import com.salespunch360.mobile.SalesPunchApp
import com.salespunch360.mobile.data.*
class LocationSyncWorker(context:Context,params:WorkerParameters):CoroutineWorker(context,params){override suspend fun doWork():Result{val app=applicationContext as SalesPunchApp;val locationDao=app.database.locations();val api=ApiClient(SecureSession(applicationContext));if(SecureSession(applicationContext).token()==null)return Result.failure();return try{for(p in locationDao.batch()){api.upload(LocationPayload(p.latitude,p.longitude,p.accuracy,p.id,p.capturedAt));locationDao.delete(p.id)};Result.success()}catch(e:ApiException){if(e.status==401){SecureSession(applicationContext).clear();TrackingService.stop(applicationContext);Result.failure()}else Result.retry()}catch(_:Exception){Result.retry()}}
 companion object{fun schedule(context:Context)=WorkManager.getInstance(context).enqueueUniqueWork("location-sync",ExistingWorkPolicy.KEEP,OneTimeWorkRequestBuilder<LocationSyncWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,java.util.concurrent.TimeUnit.SECONDS).build())}}
