package com.salespunch360.mobile.data

import com.salespunch360.mobile.BuildConfig
import android.content.Context
import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import kotlinx.serialization.json.*

/** Both native and web obtain the same atomic server purchase claim. Never log raw customer records. */
object BillingAnalytics {
 private fun prefs(context:Context)=context.getSharedPreferences("billing_measurement",Context.MODE_PRIVATE)
 fun decided(context:Context)=prefs(context).contains("analytics")
 fun allowed(context:Context)=!BuildConfig.DEBUG&&prefs(context).getBoolean("analytics",false)
 fun advertising(context:Context)=allowed(context)&&prefs(context).getBoolean("advertising",false)
 fun choose(context:Context,analytics:Boolean,ads:Boolean){
  prefs(context).edit().putBoolean("analytics",analytics).putBoolean("advertising",analytics&&ads).apply()
  restore(context)
 }
 fun restore(context:Context){runCatching{
  val sdk=FirebaseAnalytics.getInstance(context)
  val yes=FirebaseAnalytics.ConsentStatus.GRANTED;val no=FirebaseAnalytics.ConsentStatus.DENIED
  sdk.setConsent(mapOf(FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to if(allowed(context))yes else no,FirebaseAnalytics.ConsentType.AD_STORAGE to if(advertising(context))yes else no,FirebaseAnalytics.ConsentType.AD_USER_DATA to if(advertising(context))yes else no,FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to no))
  sdk.setAnalyticsCollectionEnabled(allowed(context))
 }}
 suspend fun event(context:Context,api:ApiClient,orderId:String,eventName:String){
  if(!allowed(context)||eventName !in listOf("purchase","begin_checkout"))return
  runCatching{
   // Ensure the SDK exists before consuming the server's at-most-once claim.
   val sdk=FirebaseAnalytics.getInstance(context)
   val response=api.billingAnalytics(orderId,eventName,advertising(context))
   if(response["eligible"]?.jsonPrimitive?.booleanOrNull!=true||!allowed(context))return
   val params=response["params"]?.jsonObject?:return
   val bundle=Bundle()
   for(key in listOf("transaction_id","currency","subscription_plan","billing_period","purchase_category","environment"))params[key]?.jsonPrimitive?.contentOrNull?.let{bundle.putString(key,it)}
   params["value"]?.jsonPrimitive?.doubleOrNull?.let{bundle.putDouble("value",it)}
   params["ads_eligible"]?.jsonPrimitive?.longOrNull?.let{bundle.putLong("ads_eligible",it)}
   val items=params["items"]?.jsonArray?.map{item->Bundle().apply{val obj=item.jsonObject;for(key in listOf("item_id","item_name"))obj[key]?.jsonPrimitive?.contentOrNull?.let{putString(key,it)};obj["price"]?.jsonPrimitive?.doubleOrNull?.let{putDouble("price",it)};obj["quantity"]?.jsonPrimitive?.longOrNull?.let{putLong("quantity",it)}}}
   if(items!=null)bundle.putParcelableArray("items",items.toTypedArray())
   sdk.logEvent(eventName,bundle)
  }
 }
}
