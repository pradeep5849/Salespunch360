package com.salespunch360.mobile.data

import android.content.Context
import android.os.Build
import java.util.UUID

class DeviceIdentity(context:Context){
    private val prefs=context.getSharedPreferences("mobile_device_identity",Context.MODE_PRIVATE)
    val id:String
        get(){
            val existing=prefs.getString("installation_id",null)
            if(existing!=null)return existing
            val created=UUID.randomUUID().toString()
            prefs.edit().putString("installation_id",created).apply()
            return created
        }
    val name:String
        get(){
            val manufacturer=Build.MANUFACTURER.orEmpty().trim()
            val model=Build.MODEL.orEmpty().trim()
            return listOf(manufacturer,model).filter{it.isNotBlank()}.distinct().joinToString(" ").ifBlank{"Android device"}.take(160)
        }
}
