package com.salespunch360.mobile.web

import android.webkit.CookieManager
import android.webkit.WebStorage

object AccountWebSession {
    fun clear() {
        val cookies = CookieManager.getInstance()
        cookies.setCookie(
            ACCOUNT_ORIGIN,
            "sp360_session=; Max-Age=0; Path=/; Secure; HttpOnly",
        ) { cookies.flush() }
        WebStorage.getInstance().deleteOrigin(ACCOUNT_ORIGIN)
    }
}
