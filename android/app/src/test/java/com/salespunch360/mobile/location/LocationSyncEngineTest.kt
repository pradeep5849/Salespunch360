package com.salespunch360.mobile.location

import com.salespunch360.mobile.data.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class LocationSyncEngineTest{
 private fun points(count:Int)=(1..count).map{PendingLocation("$it","owner",1.0,2.0,3.0,"2026-09-26T10:00:00Z")}.toMutableList()
 @Test fun drains120WithoutAnotherCapture()=runTest{
  val queue=points(120);val saved=mutableListOf<String>();var calls=0
  val engine=LocationSyncEngine({queue.take(50)},{batch->calls++;LocationBatchResponse(batch.map{LocationPointResult(it.id,true)},"ack")},{p,_->saved.add(p.id);queue.remove(p)},{_,_->fail()}, {true})
  assertTrue(engine.drain());assertTrue(queue.isEmpty());assertEquals(3,calls);assertEquals(120,saved.toSet().size)
 }
 @Test fun interruptedBatchIsRetainedForIdempotentRetry()=runTest{
  val queue=points(120);var calls=0
  val engine=LocationSyncEngine({queue.take(50)},{batch->if(++calls==2)throw IOException();LocationBatchResponse(batch.map{LocationPointResult(it.id,true)},"ack")},{p,_->queue.remove(p)},{_,_->fail()},{true})
  try{engine.drain();fail()}catch(_:IOException){}
  assertEquals(70,queue.size);assertEquals("51",queue.first().id)
 }
 @Test fun accountSwitchDoesNotAcknowledgeUnderNewOwner()=runTest{
  val queue=points(2);var owner=true
  val engine=LocationSyncEngine({queue},{batch->owner=false;LocationBatchResponse(batch.map{LocationPointResult(it.id,true)},"ack")},{_,_->fail()},{_,_->fail()},{owner})
  assertTrue(engine.drain());assertEquals(2,queue.size)
 }
 @Test fun explicitRejectionDoesNotAdvanceSuccessTime()=runTest{
  val queue=points(1);val reasons=mutableListOf<String>()
  val engine=LocationSyncEngine({queue.toList()},{batch->LocationBatchResponse(batch.map{LocationPointResult(it.id,false,error="CAPTURE_TIME_INVALID")},"ack")},{_,_->fail()},{p,r->queue.remove(p);reasons.add(r)},{true})
  assertTrue(engine.drain());assertEquals(listOf("CAPTURE_TIME_INVALID"),reasons)
 }
 @Test fun missingAcknowledgementRetainsPoint()=runTest{
  val queue=points(1)
  val engine=LocationSyncEngine({queue},{LocationBatchResponse(emptyList(),"ack")},{_,_->fail()},{_,_->fail()},{true})
  try{engine.drain();fail()}catch(_:IOException){}
  assertEquals(1,queue.size)
 }
}
