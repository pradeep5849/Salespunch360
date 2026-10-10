package com.salespunch360.mobile.data
import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

internal fun shouldInvalidateRejectedToken(currentToken:String?,rejectedToken:String?)=rejectedToken!=null&&currentToken==rejectedToken

class SecureSession(context:Context){
 private val prefs=EncryptedSharedPreferences.create(context,"mobile_session",MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
 fun token()=synchronized(sessionLock){memoryToken?:prefs.getString("token",null)}
 fun userId()=synchronized(sessionLock){memoryUserId?:prefs.getString("user_id",null)}
 fun save(token:String,userId:String,rememberMe:Boolean=true)=synchronized(sessionLock){
  memoryToken=if(rememberMe)null else token;memoryUserId=if(rememberMe)null else userId
  if(rememberMe)prefs.edit().putString("token",token).putString("user_id",userId).apply() else prefs.edit().remove("token").remove("user_id").apply()
 }
 fun clear()=synchronized(sessionLock){memoryToken=null;memoryUserId=null;prefs.edit().clear().apply()}
 fun invalidate(){val owner=userId();clear();invalidationEvents.tryEmit(owner)}
 fun invalidateIfCurrent(rejectedToken:String?)=synchronized(sessionLock){if(!shouldInvalidateRejectedToken(token(),rejectedToken))return@synchronized;val owner=userId();clear();invalidationEvents.tryEmit(owner)}
 fun authorizationChanged(){authorizationChangeEvents.tryEmit(Unit)}
 companion object{
  private val sessionLock=Any()
  private var memoryToken:String?=null
  private var memoryUserId:String?=null
  private val invalidationEvents=MutableSharedFlow<String?>(extraBufferCapacity=1)
  private val authorizationChangeEvents=MutableSharedFlow<Unit>(extraBufferCapacity=1)
  val invalidations=invalidationEvents.asSharedFlow()
  val authorizationChanges=authorizationChangeEvents.asSharedFlow()
 }
}
