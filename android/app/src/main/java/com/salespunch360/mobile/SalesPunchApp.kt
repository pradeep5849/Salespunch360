package com.salespunch360.mobile
import android.app.Application
import com.salespunch360.mobile.data.AppDatabase
class SalesPunchApp:Application(){ val database by lazy{AppDatabase.create(this)} }
