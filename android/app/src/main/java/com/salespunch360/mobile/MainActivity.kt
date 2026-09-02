package com.salespunch360.mobile

import android.os.Bundle
import android.Manifest
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.ui.AppTheme
import com.salespunch360.mobile.ui.AuthenticatedApp
import com.salespunch360.mobile.ui.LoadingScreen
import com.salespunch360.mobile.ui.LoginScreen
import com.salespunch360.mobile.ui.RetryScreen

class MainActivity:ComponentActivity(){private val notifications=registerForActivityResult(ActivityResultContracts.RequestPermission()){};override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);if(Build.VERSION.SDK_INT>=33)notifications.launch(Manifest.permission.POST_NOTIFICATIONS);setContent{AppTheme{SalesPunchAppRoot()}}}}

@Composable fun SalesPunchAppRoot(vm:MainViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 when(state.status){
  AppStatus.STARTING->LoadingScreen("Securing your session…")
  AppStatus.SIGNED_OUT->LoginScreen(state.message,state.submitting,vm::clearMessage,vm::login)
  AppStatus.RECOVERABLE_ERROR->RetryScreen(state.message?:"Unable to connect",vm::validateSession,vm::logout)
  AppStatus.AUTHENTICATED->state.bootstrap?.let{AuthenticatedApp(it,state.message,vm::clearMessage,{start,location,done->vm.attendance(start,location,done)},vm::logout)}?:LoadingScreen()
 }
}
