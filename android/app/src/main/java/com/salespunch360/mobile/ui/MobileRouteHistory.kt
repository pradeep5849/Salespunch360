package com.salespunch360.mobile.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/**
 * Small native navigation history for the Android workspace shells.
 * The root destination is intentionally not consumed by BackHandler so
 * Android can exit only when the user is already at the workspace home.
 */
internal class MobileRouteHistory(private val root: String) {
    private val previous = mutableListOf<String>()

    var current by mutableStateOf(root)
        private set

    val canGoBack: Boolean
        get() = previous.isNotEmpty() || current != root

    fun navigate(destination: String) {
        if (destination == current) return
        previous += current
        if (previous.size > 50) previous.removeAt(0)
        current = destination
    }

    fun replace(destination: String) {
        current = destination
    }

    fun back(): Boolean {
        if (previous.isNotEmpty()) {
            current = previous.removeAt(previous.lastIndex)
            return true
        }
        if (current != root) {
            current = root
            return true
        }
        return false
    }

    fun reset() {
        previous.clear()
        current = root
    }
}

@Composable
internal fun rememberMobileRouteHistory(root: String = "Dashboard") =
    remember(root) { MobileRouteHistory(root) }
