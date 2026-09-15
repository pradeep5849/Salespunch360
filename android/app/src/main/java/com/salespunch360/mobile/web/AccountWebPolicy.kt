package com.salespunch360.mobile.web

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

const val ACCOUNT_ORIGIN = "https://www.salespunch360.com"
const val ACCOUNT_ROOT = "/workspace/account"
const val HANDOFF_PATH = "/mobile/web-session"
const val HANDOFF_URL = "$ACCOUNT_ORIGIN$HANDOFF_PATH"

enum class AccountNavigation {
    ACCOUNT,
    ACCOUNT_RESOURCE,
    HANDOFF,
    SESSION_RECOVERY,
    EXTERNAL_HTTPS,
    BLOCKED,
}

private val accountResourcePrefixes = listOf(
    "/api/project-documents/",
    "/api/expense-attachments/",
    "/api/account/print/",
    "/api/account/reports/",
    "/api/account/utilities/export/",
    "/api/account/utilities/templates/",
)

private val accountResourceExactPaths = setOf(
    "/api/account/utilities/backup",
)

private fun parsed(raw: String): URI? {
    if (raw.isBlank() || raw.contains('\') || raw.contains("%5c", ignoreCase = true)) return null
    return runCatching { URI(raw) }.getOrNull()
}

private fun canonical(uri: URI): Boolean =
    uri.scheme?.equals("https", ignoreCase = true) == true &&
        uri.host?.equals("www.salespunch360.com", ignoreCase = true) == true &&
        uri.userInfo == null &&
        (uri.port == -1 || uri.port == 443)

private fun safePath(uri: URI): String? {
    val rawPath = uri.rawPath ?: return null
    if (
        rawPath.contains("%5c", ignoreCase = true) ||
        rawPath.contains("%2f", ignoreCase = true) ||
        rawPath.contains("%2e", ignoreCase = true)
    ) {
        return null
    }
    val path = uri.path ?: return null
    if (path.split('/').any { it == "." || it == ".." }) return null
    return path
}

private fun accountPath(uri: URI): Boolean {
    val path = safePath(uri) ?: return false
    return path == ACCOUNT_ROOT || path.startsWith("$ACCOUNT_ROOT/")
}

private fun accountResourcePath(uri: URI): Boolean {
    val path = safePath(uri) ?: return false
    return path in accountResourceExactPaths ||
        accountResourcePrefixes.any { prefix -> path.startsWith(prefix) }
}

fun classifyAccountUrl(raw: String, allowHandoff: Boolean = false): AccountNavigation {
    val uri = parsed(raw) ?: return AccountNavigation.BLOCKED
    if (uri.userInfo != null) return AccountNavigation.BLOCKED
    if (uri.scheme?.equals("https", ignoreCase = true) != true) return AccountNavigation.BLOCKED
    if (!canonical(uri)) {
        return if (uri.host.isNullOrBlank()) AccountNavigation.BLOCKED else AccountNavigation.EXTERNAL_HTTPS
    }
    if (accountPath(uri)) return AccountNavigation.ACCOUNT
    if (accountResourcePath(uri)) return AccountNavigation.ACCOUNT_RESOURCE
    if (safePath(uri) == "/sign-in") return AccountNavigation.SESSION_RECOVERY
    if (allowHandoff && safePath(uri) == HANDOFF_PATH) return AccountNavigation.HANDOFF
    return AccountNavigation.BLOCKED
}

fun isCanonicalHttpsUrl(raw: String): Boolean {
    val uri = parsed(raw) ?: return false
    return canonical(uri) && safePath(uri) != null
}

fun isAllowedAccountDownloadUrl(raw: String): Boolean =
    when (classifyAccountUrl(raw)) {
        AccountNavigation.ACCOUNT,
        AccountNavigation.ACCOUNT_RESOURCE -> true
        else -> false
    }

fun accountRelativePathOrNull(raw: String): String? {
    if (raw.isBlank() || raw.contains('\') || raw.contains("%5c", ignoreCase = true)) return null
    val uri = runCatching {
        if (raw.startsWith("/")) URI("$ACCOUNT_ORIGIN$raw") else URI(raw)
    }.getOrNull() ?: return null
    if (!canonical(uri) || !accountPath(uri)) return null
    return buildString {
        append(uri.rawPath)
        if (!uri.rawQuery.isNullOrBlank()) {
            append('?')
            append(uri.rawQuery)
        }
    }
}

fun handoffFormBody(code: String): ByteArray =
    ("code=" + URLEncoder.encode(code, StandardCharsets.UTF_8.name()))
        .toByteArray(StandardCharsets.UTF_8)
