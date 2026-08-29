package com.salespunch360.mobile.data
import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
class SecureSession(context:Context){private val prefs=EncryptedSharedPreferences.create(context,"mobile_session",MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
 fun token()=prefs.getString("token",null);fun save(token:String)=prefs.edit().putString("token",token).apply();fun clear()=prefs.edit().clear().apply()}
