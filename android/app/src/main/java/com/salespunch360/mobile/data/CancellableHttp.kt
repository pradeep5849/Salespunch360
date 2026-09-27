package com.salespunch360.mobile.data

import java.io.IOException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import kotlin.coroutines.resumeWithException

suspend fun Call.awaitResponse():Response=suspendCancellableCoroutine { continuation ->
 continuation.invokeOnCancellation{cancel()}
 enqueue(object:Callback{
  override fun onFailure(call:Call,error:IOException){if(continuation.isActive)continuation.resumeWithException(error)}
  override fun onResponse(call:Call,response:Response){continuation.resume(response){_,value,_->value.close()}}
 })
}
