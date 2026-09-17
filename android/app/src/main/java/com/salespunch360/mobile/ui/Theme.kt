package com.salespunch360.mobile.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Keep native Sales visually aligned with the web workspace design tokens.
val SalesNavy = Color(0xFF0B1930)
val SalesBlue = Color(0xFF2864EC)
val SalesInk = Color(0xFF172033)
val SalesMuted = Color(0xFF697386)
val SalesLine = Color(0xFFDFE5EF)
val SalesPale = Color(0xFFF5F7FB)
val SalesSuccess = Color(0xFF067647)
val SalesSuccessContainer = Color(0xFFECFDF3)

private val Colors = lightColorScheme(
    primary = SalesBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEAF0FF),
    onPrimaryContainer = SalesNavy,
    secondary = SalesNavy,
    onSecondary = Color.White,
    background = SalesPale,
    onBackground = SalesInk,
    surface = Color.White,
    onSurface = SalesInk,
    surfaceVariant = Color(0xFFEEF3FF),
    onSurfaceVariant = SalesMuted,
    outline = SalesLine,
)

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, content = content)
}
