package com.salespunch360.mobile.data

import android.content.Context

fun validatedWorkspaces(bootstrap: Bootstrap): Set<Workspace> =
    bootstrap.authorizedWorkspaces.toSet().filterTo(linkedSetOf()) { workspace ->
        when (workspace) {
            Workspace.SALES -> bootstrap.user.salesRole != null
            Workspace.ACCOUNT -> bootstrap.user.accountRole != null
        }
    }

fun resolveWorkspace(authorized: Set<Workspace>, saved: Workspace?): Workspace? {
    if (authorized.isEmpty()) return null
    if (saved != null && saved in authorized) return saved
    return when {
        Workspace.SALES in authorized -> Workspace.SALES
        Workspace.ACCOUNT in authorized -> Workspace.ACCOUNT
        else -> null
    }
}

class WorkspacePreferenceStore(context: Context) {
    private val prefs = context.getSharedPreferences("workspace_preference", Context.MODE_PRIVATE)

    fun get(): Workspace? =
        prefs.getString("workspace", null)?.let { runCatching { Workspace.valueOf(it) }.getOrNull() }

    fun save(workspace: Workspace) {
        prefs.edit().putString("workspace", workspace.name).apply()
    }

    fun clear() {
        prefs.edit().remove("workspace").apply()
    }
}
