package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class FollowUpMutationClient(private val session:SecureSession){
 private val http=OkHttpClient()
 private val media="application/json".toMediaType()
 suspend fun completeCall(taskId:String)=mutate("COMPLETE_CALL",taskId)
 private suspend fun mutate(action:String,taskId:String)=withContext(Dispatchers.IO){
  val token=session.token()
  val body="{\"action\":\"$action\",\"taskId\":\"$taskId\"}"
  val request=Request.Builder().url(BuildConfig.API_BASE_URL+"api/v1/mobile/follow-ups").header("Accept","application/json").apply{token?.let{header("Authorization","Bearer $it")}}.post(body.toRequestBody(media)).build()
  http.newCall(request).execute().use{response->if(!response.isSuccessful){if(response.code==401)session.invalidateIfCurrent(token);if(response.code==403)session.authorizationChanged();throw ApiException(response.code,"FOLLOW_UP_MUTATION_FAILED")}}
 }
}
