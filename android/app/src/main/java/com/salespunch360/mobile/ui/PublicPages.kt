package com.salespunch360.mobile.ui
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.salespunch360.mobile.BuildConfig
/** Public pages share the web implementation, including forms, articles and legal content. */
internal val publicPagePaths=setOf("/","/products","/features","/industries","/pricing","/resources","/about","/contact","/help","/blog","/careers","/user-guide","/video-tutorials","/resources/faq","/privacy","/terms","/android")
internal fun publicPageUrl(base:String,path:String):String {require(path in publicPagePaths);return base.trimEnd('/')+path}
fun openPublicPage(context:Context,path:String="/") {val uri=Uri.parse(publicPageUrl(BuildConfig.API_BASE_URL,path));try{CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context,uri)}catch(_:android.content.ActivityNotFoundException){context.startActivity(Intent(Intent.ACTION_VIEW,uri))}}
