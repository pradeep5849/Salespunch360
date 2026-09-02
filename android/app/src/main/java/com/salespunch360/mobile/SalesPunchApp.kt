package com.salespunch360.mobile
import android.app.Application
import com.salespunch360.mobile.data.AppDatabase
import com.salespunch360.mobile.push.PushNotifications
class SalesPunchApp:Application(){ val database by lazy{AppDatabase.create(this)};override fun onCreate(){super.onCreate();PushNotifications.ensureChannel(this)} }
