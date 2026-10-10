package com.salespunch360.mobile.data

import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SecureSessionPersistenceTest {
 private val context=ApplicationProvider.getApplicationContext<android.content.Context>()
 private fun storage(session:SecureSession)=SecureSession::class.java.getDeclaredField("prefs").apply{isAccessible=true}.get(session) as SharedPreferences
 @After fun clear(){SecureSession(context).clear()}
 @Test fun uncheckedSessionStaysInMemoryAndRemovesPreviousPersistentToken(){
  val session=SecureSession(context)
  session.save("previous","user",true)
  session.save("temporary","user",false)
  assertNull(storage(session).getString("token",null))
  assertNull(storage(session).getString("user_id",null))
  assertEquals("temporary",SecureSession(context).token())
  session.invalidateIfCurrent("previous")
  assertEquals("temporary",session.token())
  session.invalidateIfCurrent("temporary")
  assertNull(session.token())
 }
 @Test fun checkedSessionUsesEncryptedPersistentStorageAndLogoutClearsIt(){
  val session=SecureSession(context)
  session.save("remembered","user",true)
  assertEquals("remembered",storage(session).getString("token",null))
  assertEquals("remembered",SecureSession(context).token())
  session.clear()
  assertNull(storage(session).getString("token",null))
  assertNull(SecureSession(context).token())
 }
}
