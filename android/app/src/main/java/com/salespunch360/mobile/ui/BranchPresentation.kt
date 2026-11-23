package com.salespunch360.mobile.ui
import androidx.compose.runtime.*

/** Presentation only. Existing branch IDs and API authorization remain intact. */
internal val LocalBranchUiEnabled=compositionLocalOf{true}
internal val LocalCanAddBranches=compositionLocalOf{false}
internal val LocalSetBranchUiEnabled=compositionLocalOf<(Boolean)->Unit>{{}}
@Composable internal fun CompanyBranchPresentationProvider(enabled:Boolean,canAdd:Boolean=false,content:@Composable ()->Unit){
 var current by remember(enabled){mutableStateOf(enabled)}
 CompositionLocalProvider(LocalBranchUiEnabled provides current,LocalCanAddBranches provides canAdd,LocalSetBranchUiEnabled provides {current=it},content=content)
}
internal fun isCompanyBranchControl(label:String)=label.lowercase() in setOf("branch","branch (optional)","posting branch","opening journal branch","loan branch","firm","firm / company branch","view branch")
@Composable internal fun hideSingleLocationBranchControl(label:String,value:String,ids:List<String>,onSelect:(String)->Unit):Boolean{
 val hide=!LocalBranchUiEnabled.current&&isCompanyBranchControl(label)
 val single=ids.filter{it.matches(Regex("[0-9a-fA-F-]{36}"))}.distinct().singleOrNull()
 LaunchedEffect(hide,value,single){if(hide&&value.isBlank()&&single!=null&&!label.contains("optional",ignoreCase=true))onSelect(single)}
 return hide
}
@Composable internal fun BranchOnly(content:@Composable ()->Unit){if(LocalBranchUiEnabled.current)content()}
