package com.salespunch360.mobile.ui.account.expense

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/** Collects one local billed-line name; the expense save owns accounting writes. */
@Composable
internal fun AddExpenseItemScreen(onClose: () -> Unit, onSave: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                Row(Modifier.fillMaxWidth().padding(16.dp)) {
                    IconButton(onClose) { Icon(Icons.Default.ArrowBack, "Back to expense") }
                    Text("Add Expense Item", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 10.dp))
                }
                HorizontalDivider()
                Column(Modifier.weight(1f).padding(16.dp)) {
                    OutlinedTextField(
                        name, { if (it.length <= 240) name = it },
                        label = { Text("Item name *") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth().focusRequester(focus),
                    )
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClose, modifier = Modifier.weight(1f)) { Text("Cancel") }
                    Button({ onSave(name.trim()) }, enabled = name.isNotBlank(), modifier = Modifier.weight(1f)) { Text("Save item") }
                }
            }
        }
        LaunchedEffect(Unit) { focus.requestFocus() }
    }
}
