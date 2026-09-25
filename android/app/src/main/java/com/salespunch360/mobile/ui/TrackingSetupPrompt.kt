package com.salespunch360.mobile.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

@Composable
fun TrackingSetupPrompt(enabled:Boolean){
    if(!enabled)return
    val context=LocalContext.current
    val lifecycleOwner=LocalLifecycleOwner.current
    var refresh by remember{mutableIntStateOf(0)}
    DisposableEffect(lifecycleOwner){
        val observer=LifecycleEventObserver{_,event->if(event==Lifecycle.Event.ON_RESUME)refresh++}
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose{lifecycleOwner.lifecycle.removeObserver(observer)}
    }
    val permissionLauncher=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){refresh++}
    val backgroundLauncher=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){refresh++}
    val fineGranted=remember(refresh){ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED}
    val backgroundGranted=remember(refresh){Build.VERSION.SDK_INT<29||ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED}
    val batteryAllowed=remember(refresh){val manager=context.getSystemService(Context.POWER_SERVICE) as PowerManager;manager.isIgnoringBatteryOptimizations(context.packageName)}

    when{
        !fineGranted->AlertDialog(
            onDismissRequest={},
            title={Text("Location Permission")},
            text={Text("SalesPunch360 needs precise location for attendance, check-ins and accurate field tracking. Please allow precise location while using the app.")},
            confirmButton={Button({permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION))}){Text("Continue")}},
        )
        !backgroundGranted->AlertDialog(
            onDismissRequest={},
            title={Text("Background Location Permission")},
            text={Text("SalesPunch360 needs background location while Attendance is ON so distance and field movement can continue when the app is minimized or the screen is locked. Please select Allow all the time.")},
            confirmButton={Button({
                if(Build.VERSION.SDK_INT>=30){
                    context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:${context.packageName}")))
                }else{
                    backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                }
            }){Text("Continue")}},
        )
        !batteryAllowed->AlertDialog(
            onDismissRequest={},
            title={Text("Battery Optimization")},
            text={Text("Battery optimization can restrict SalesPunch360 in the background. Please allow SalesPunch360 to run without battery restrictions for reliable tracking while Attendance is ON.")},
            confirmButton={Button({openBatterySettings(context)}){Text("Open Settings")}},
        )
    }
}

private fun openBatterySettings(context:Context){
    runCatching{context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))}
        .getOrElse{context.startActivity(Intent(Settings.ACTION_SETTINGS))}
}
