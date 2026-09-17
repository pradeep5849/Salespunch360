package com.salespunch360.mobile.data
import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

internal fun shouldInvalidateRejectedToken(currentToken:String?,rejectedToken:String?)=rejectedToken!=null&&currentToken==rejectedToken

class SecureSession(context:Context){
 private val prefs=EncryptedSharedPreferences.create(context,"mobile_session",MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
 fun token()=prefs.getString("token",null)
 fun userId()=prefs.getString("user_id",null)
 fun save(token:String,userId:String)=prefs.edit().putString("token",token).putString("user_id",userId).apply()
 fun clear(){prefs.edit().clear().apply()}
 fun invalidate(){val owner=userId();clear();invalidationEvents.tryEmit(owner)}
 fun invalidateIfCurrent(rejectedToken:String?){if(!shouldInvalidateRejectedToken(token(),rejectedToken))return;val owner=userId();clear();invalidationEvents.tryEmit(owner)}
 fun authorizationChanged(){authorizationChangeEvents.tryEmit(Unit)}
 companion object{
  private val invalidationEvents=MutableSharedFlow<String?>(extraBufferCapacity=1)
  private val authorizationChangeEvents=MutableSharedFlow<Unit>(extraBufferCapacity=1)
  val invalidations=invalidationEvents.asSharedFlow()
  val authorizationChanges=authorizationChangeEvents.asSharedFlow()
 }
}
