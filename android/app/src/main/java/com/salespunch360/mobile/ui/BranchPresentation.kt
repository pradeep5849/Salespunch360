package com.salespunch360.mobile.ui
import androidx.compose.runtime.*

/** Presentation only. Existing branch IDs and API authorization remain intact. */
internal val LocalBranchUiEnabled=compositionLocalOf{true}
internal val LocalSetBranchUiEnabled=compositionLocalOf<(Boolean)->Unit>{{}}
@Composable internal fun CompanyBranchPresentationProvider(enabled:Boolean,content:@Composable ()->Unit){
 var current by remember(enabled){mutableStateOf(enabled)}
 CompositionLocalProvider(LocalBranchUiEnabled provides current,LocalSetBranchUiEnabled provides {current=it},content=content)
}
