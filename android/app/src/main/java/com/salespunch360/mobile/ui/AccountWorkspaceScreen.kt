package com.salespunch360.mobile.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.salespunch360.mobile.BuildConfig
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.data.WebSessionHandoff
import com.salespunch360.mobile.web.AccountDownloadManager
import com.salespunch360.mobile.web.AccountNavigation
import com.salespunch360.mobile.web.HANDOFF_URL
import com.salespunch360.mobile.web.classifyAccountUrl
import com.salespunch360.mobile.web.handoffFormBody
import com.salespunch360.mobile.web.isAllowedAccountDownloadUrl

private enum class AccountLoadState { LOADING, READY, OFFLINE, ERROR, SESSION_RECOVERY }

private fun canGoBackSafely(view: WebView): Boolean {
    val history = view.copyBackForwardList()
    val previousIndex = history.currentIndex - 1
    if (previousIndex < 0) return false
    val previousUrl = history.getItemAtIndex(previousIndex)?.url ?: return false
    return classifyAccountUrl(previousUrl) == AccountNavigation.ACCOUNT
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountWorkspaceScreen(
    data: Bootstrap,
    redirectPath: String,
    sessionEpoch: Int,
    requestHandoff: (String, (Result<WebSessionHandoff>) -> Unit) -> Unit,
    recoverSession: () -> Unit,
    switchToSales: (() -> Unit)?,
    logout: () -> Unit,
) {
    val context = LocalContext.current
    var webView by remember { mutableStateOf<WebView?>(null) }
    var loadState by remember { mutableStateOf(AccountLoadState.LOADING) }
    var message by remember { mutableStateOf<String?>(null) }
    var retryNonce by remember { mutableIntStateOf(0) }
    var rendererEpoch by remember { mutableIntStateOf(0) }
    var recoveryAttempts by remember { mutableIntStateOf(0) }
    var canGoBack by remember { mutableStateOf(false) }
    var fileCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileCallback
        fileCallback = null
        val returned = result.data
        val uris = if (result.resultCode == Activity.RESULT_OK && returned != null) {
            when {
                returned.clipData != null -> Array(returned.clipData!!.itemCount) { index -> returned.clipData!!.getItemAt(index).uri }
                returned.data != null -> arrayOf(returned.data!!)
                else -> null
            }
        } else null
        callback?.onReceiveValue(uris)
    }

    BackHandler(enabled = canGoBack || switchToSales != null) {
        val current = webView
        if (current != null && canGoBackSafely(current)) current.goBack() else switchToSales?.invoke()
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Column { Text("Account"); Text(data.company.name, style = MaterialTheme.typography.labelSmall) } },
            actions = {
                switchToSales?.let { action -> TextButton(onClick = action) { Text("Sales") } }
                TextButton(onClick = logout) { Text("Sign out") }
            },
        )
    }) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            key(rendererEpoch) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = true
                            @Suppress("DEPRECATION")
                            settings.allowFileAccessFromFileURLs = false
                            @Suppress("DEPRECATION")
                            settings.allowUniversalAccessFromFileURLs = false
                            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            settings.setSupportMultipleWindows(false)

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                                WebView.startSafeBrowsing(ctx) { _ -> }
                            }

                            val cookieManager = CookieManager.getInstance()
                            cookieManager.setAcceptCookie(true)
                            cookieManager.setAcceptThirdPartyCookies(this, false)

                            webChromeClient = object : WebChromeClient() {
                                override fun onShowFileChooser(view: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                                    if (callback == null || params == null || classifyAccountUrl(view?.url.orEmpty()) != AccountNavigation.ACCOUNT) return false
                                    fileCallback?.onReceiveValue(null)
                                    fileCallback = callback
                                    val types = params.acceptTypes.mapNotNull { type -> type.trim().takeIf { it.contains("/") && it.length <= 120 } }.distinct()
                                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                                        addCategory(Intent.CATEGORY_OPENABLE)
                                        type = if (types.size == 1) types.first() else "*/*"
                                        if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
                                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                                    }
                                    return runCatching { filePicker.launch(intent); true }.getOrElse {
                                        fileCallback?.onReceiveValue(null); fileCallback = null; false
                                    }
                                }
                            }

                            setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                                if (url != null && isAllowedAccountDownloadUrl(url)) AccountDownloadManager.download(context, url, userAgent, contentDisposition, mimeType)
                            }

                            webViewClient = object : WebViewClient() {
                                private fun recoverOnce() {
                                    if (recoveryAttempts >= 1) { loadState = AccountLoadState.ERROR; message = "Account session could not be restored."; return }
                                    recoveryAttempts += 1; loadState = AccountLoadState.SESSION_RECOVERY; message = null; recoverSession()
                                }
                                private fun handle(raw: String): Boolean = when (classifyAccountUrl(raw)) {
                                    AccountNavigation.ACCOUNT, AccountNavigation.ACCOUNT_RESOURCE -> false
                                    AccountNavigation.SESSION_RECOVERY -> { recoverOnce(); true }
                                    AccountNavigation.EXTERNAL_HTTPS -> { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(raw))) }; true }
                                    AccountNavigation.HANDOFF, AccountNavigation.BLOCKED -> true
                                }
                                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = handle(request?.url?.toString().orEmpty())
                                @Suppress("DEPRECATION")
                                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean = handle(url.orEmpty())
                                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                    super.onPageStarted(view, url, favicon)
                                    when (classifyAccountUrl(url.orEmpty(), allowHandoff = true)) {
                                        AccountNavigation.SESSION_RECOVERY -> recoverOnce()
                                        AccountNavigation.ACCOUNT, AccountNavigation.ACCOUNT_RESOURCE, AccountNavigation.HANDOFF -> loadState = AccountLoadState.LOADING
                                        else -> Unit
                                    }
                                }
                                override fun onPageFinished(view: WebView?, url: String?) {
                                    super.onPageFinished(view, url)
                                    if (classifyAccountUrl(url.orEmpty()) in setOf(AccountNavigation.ACCOUNT, AccountNavigation.ACCOUNT_RESOURCE)) {
                                        loadState = AccountLoadState.READY; message = null; recoveryAttempts = 0; canGoBack = view?.let(::canGoBackSafely) == true
                                    }
                                }
                                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                                    super.onReceivedError(view, request, error)
                                    if (request?.isForMainFrame == true) { loadState = AccountLoadState.OFFLINE; message = "Unable to load Account. Check your connection and try again." }
                                }
                                override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                                    super.onReceivedHttpError(view, request, errorResponse)
                                    if (request?.isForMainFrame != true) return
                                    when (errorResponse?.statusCode) { 401 -> recoverOnce(); 403 -> { message = "Account access changed. Refreshing authorization…"; recoverOnce() } }
                                }
                                override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                                    handler?.cancel(); loadState = AccountLoadState.ERROR; message = "Secure connection failed."
                                }
                                override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                                    view?.destroy(); canGoBack = false; webView = null; rendererEpoch += 1; loadState = AccountLoadState.ERROR; message = "Account view restarted. Tap Retry."; return true
                                }
                            }
                            webView = this
                        }
                    },
                    update = { webView = it },
                )
            }

            if (loadState != AccountLoadState.READY) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
                    when (loadState) {
                        AccountLoadState.LOADING -> LoadingScreen("Loading Account…")
                        AccountLoadState.SESSION_RECOVERY -> LoadingScreen("Restoring Account session…")
                        AccountLoadState.OFFLINE, AccountLoadState.ERROR -> RetryScreen(message ?: "Unable to load Account", retry = { retryNonce += 1 })
                        AccountLoadState.READY -> Unit
                    }
                }
            }
        }
    }

    LaunchedEffect(redirectPath, sessionEpoch, retryNonce, rendererEpoch, webView) {
        val target = webView ?: return@LaunchedEffect
        loadState = AccountLoadState.LOADING; message = null
        requestHandoff(redirectPath) { result ->
            result.onSuccess { handoff -> if (webView === target) target.postUrl(HANDOFF_URL, handoffFormBody(handoff.handoffCode)) }
                .onFailure { error ->
                    if (webView !== target) return@onFailure
                    loadState = if (error is java.io.IOException) AccountLoadState.OFFLINE else AccountLoadState.ERROR
                    message = when {
                        error is ApiException && error.status == 403 -> "Account access changed. Refreshing authorization…"
                        error is ApiException && error.status == 401 -> "Your session expired."
                        error is java.io.IOException -> "You're offline. Reconnect and try again."
                        else -> "Unable to open Account. Tap Retry."
                    }
                }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            fileCallback?.onReceiveValue(null); fileCallback = null; webView?.stopLoading(); webView?.destroy(); webView = null
        }
    }
}
