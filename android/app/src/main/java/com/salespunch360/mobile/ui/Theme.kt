package com.salespunch360.mobile.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Colors=lightColorScheme(primary=Color(0xFF176B5B),secondary=Color(0xFF4B635D),surfaceVariant=Color(0xFFE0EAE6),background=Color(0xFFF7FAF8))
@Composable fun AppTheme(content: @Composable () -> Unit){MaterialTheme(colorScheme=Colors,content=content)}
