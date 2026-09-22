package com.salespunch360.mobile
import android.net.Uri
/** Only internal Account deep links can enter the native Account navigator. */
fun nativeAccountPathOrNull(raw:String):String?=runCatching{val uri=Uri.parse(raw);val path=uri.path.orEmpty();if((uri.scheme==null||uri.scheme=="salespunch360")&&(path=="/workspace/account"||path.startsWith("/workspace/account/")))path+(uri.query?.let{"?$it"}?:"") else null}.getOrNull()
