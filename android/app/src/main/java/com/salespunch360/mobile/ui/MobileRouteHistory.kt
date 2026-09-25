package com.salespunch360.mobile.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Lightweight route signal used by route-owned ViewModels to avoid doing
 * expensive work while their screen is not open.
 */
internal object MobileRouteSignal {
    private val _current = MutableStateFlow("Dashboard")
    val current: StateFlow<String> = _current.asStateFlow()

    fun update(route: String) {
        _current.value = route
    }
}

/**
 * Small native navigation history for the Android workspace shells.
 * The root destination is intentionally not consumed by BackHandler so
 * Android can exit only when the user is already at the workspace home.
 */
internal class MobileRouteHistory(private val root: String) {
    private val previous = mutableListOf<String>()

    var current by mutableStateOf(root)
        private set

    init {
        MobileRouteSignal.update(root)
    }

    val canGoBack: Boolean
        get() = previous.isNotEmpty() || current != root

    private fun applyDestination(destination: String) {
        current = destination
        MobileRouteSignal.update(destination)
    }

    fun navigate(destination: String) {
        if (destination == current) return
        previous += current
        if (previous.size > 50) previous.removeAt(0)
        applyDestination(destination)
    }

    fun replace(destination: String) {
        applyDestination(destination)
    }

    fun back(): Boolean {
        if (previous.isNotEmpty()) {
            applyDestination(previous.removeAt(previous.lastIndex))
            return true
        }
        if (current != root) {
            applyDestination(root)
            return true
        }
        return false
    }

    fun reset() {
        previous.clear()
        applyDestination(root)
    }
}

@Composable
internal fun rememberMobileRouteHistory(root: String = "Dashboard"): MobileRouteHistory {
    val history = remember(root) { MobileRouteHistory(root) }
    DisposableEffect(history) {
        onDispose { MobileRouteSignal.update("") }
    }
    return history
}
