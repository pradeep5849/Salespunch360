package com.salespunch360.mobile

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.data.Workspace
import com.salespunch360.mobile.data.MobileRole
import com.salespunch360.mobile.data.validatedWorkspaces
import com.salespunch360.mobile.ui.*

class MainActivity : ComponentActivity() {
    private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private var deepLink by mutableStateOf<String?>(null)
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState);deepLink=intent?.dataString;if(Build.VERSION.SDK_INT>=33)notifications.launch(Manifest.permission.POST_NOTIFICATIONS);setContent{AppTheme{SalesPunchAppRoot(deepLink=deepLink)}} }
    override fun onNewIntent(intent:Intent){super.onNewIntent(intent);setIntent(intent);deepLink=intent.dataString}
}

@Composable fun SalesPunchAppRoot(vm:MainViewModel=viewModel(),deepLink:String?=null){
 var showSignUp by rememberSaveable{mutableStateOf(false)}
 val state=vm.state.collectAsStateWithLifecycle().value;LaunchedEffect(deepLink){if(deepLink!=null)vm.handleDeepLink(deepLink)}
 when(state.status){
  AppStatus.STARTING->LoadingScreen("Securing your session…")
  AppStatus.SIGNED_OUT->if(showSignUp)NativeRegistrationScreen(onBack={showSignUp=false},onRegistered={showSignUp=false}) else LoginScreen(state.message,state.submitting,vm::clearMessage,vm::login){showSignUp=true}
  AppStatus.RECOVERABLE_ERROR->RetryScreen(state.message?:"Unable to connect",vm::validateSession,vm::logout)
  AppStatus.AUTHENTICATED->{val data=state.bootstrap;val canSwitch=data?.let{it.canSwitchWorkspace&&validatedWorkspaces(it).size==2}==true;if(data==null||state.workspace==null)LoadingScreen() else when(state.workspace){
   Workspace.SALES->{if(data.user.salesRole==null)RetryScreen("Sales access changed. Refresh your session.",vm::validateSession,vm::logout) else {val switch=if(canSwitch){{vm.switchToAccount()}}else null;when(data.user.salesRole){MobileRole.SALES->SalesDrawerAuthenticatedApp(data,state.message,vm::clearMessage,{start,location,done->vm.attendance(start,location,done)},vm::logout,switch);MobileRole.PRIMARY_ADMIN->PrimaryAdminAuthenticatedApp(data,state.message,vm::clearMessage,vm::logout,switch);MobileRole.ADMIN,MobileRole.MANAGER->AdminManagerAuthenticatedApp(data,state.message,vm::clearMessage,{start,location,done->vm.attendance(start,location,done)},vm::logout,switch)}}}
   Workspace.ACCOUNT->AccountWorkspaceScreen(data,state.accountPath,state.accountSessionEpoch,vm::requestAccountHandoff,vm::recoverAccountSession,if(canSwitch)vm::switchToSales else null,vm::logout)
  }}
 }
}