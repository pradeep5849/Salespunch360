package com.salespunch360.mobile.location

import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

class LocationSyncEngine(
 private val nextBatch:suspend()->List<PendingLocation>,
 private val upload:suspend(List<PendingLocation>)->LocationBatchResponse,
 private val acknowledge:suspend(PendingLocation,String)->Unit,
 private val discard:suspend(PendingLocation,String)->Unit,
 private val currentOwner:()->Boolean,
 private val elapsed:()->Long={System.nanoTime()/1_000_000},
 private val budgetMillis:Long=120_000,
){
 suspend fun drain():Boolean{
  val start=elapsed()
  while(elapsed()-start<budgetMillis){
   currentCoroutineContext().ensureActive()
   if(!currentOwner())return true
   val points=nextBatch();if(points.isEmpty())return true
   val response=upload(points)
   if(!currentOwner())return true
   val results=response.results.associateBy{it.clientPointId}
   for(point in points){
    currentCoroutineContext().ensureActive()
    if(!currentOwner())return true
    val result=results[point.id]?:throw IOException("Missing GPS acknowledgement")
    when{
     result.acknowledged->acknowledge(point,response.receivedAt)
     result.error in setOf("CAPTURE_TIME_INVALID","NO_OPEN_ATTENDANCE","THROTTLED")->discard(point,result.error!!)
     else->throw ApiException(409,result.error)
    }
   }
  }
  return false
 }
}
