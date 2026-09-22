package com.salespunch360.mobile.ui.account.admin

import android.content.Intent
import java.io.File
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountUtilityViewModel
import kotlinx.serialization.json.*

@Composable
fun AccountUtilityScreen(
    mode: String,
    padding: PaddingValues,
    vm: AccountUtilityViewModel = viewModel()
) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    var importType by remember { mutableStateOf("CUSTOMERS") }
    var confirmRestore by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val name = uri.lastPathSegment?.substringAfterLast('/') ?: "import.csv"
            val mime = context.contentResolver.getType(uri) ?: if (name.endsWith(".xlsx")) {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            } else {
                "text/csv"
            }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                vm.upload(importType, name, mime, stream.readBytes(), false)
            }
        }
    }

    LaunchedEffect(mode) { vm.load(mode) }

    LaunchedEffect(state.file) {
        state.file?.let { downloadable ->
            val file = File(context.cacheDir, downloadable.first)
            file.writeBytes(downloadable.second)
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
            val mime = if (file.extension == "xlsx") {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            } else {
                "application/json"
            }
            val send = Intent(Intent.ACTION_SEND)
                .setType(mime)
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(send, "Share ${file.name}"))
            vm.consumed()
        }
    }

    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
        Text(mode.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.headlineSmall)
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }

        when (mode) {
            "import" -> {
                Row {
                    listOf("CUSTOMERS", "VENDORS", "ITEMS", "PROJECTS", "OPENING_BALANCES").forEach { type ->
                        FilterChip(importType == type, { importType = type }, { Text(type) })
                    }
                }
                Button(onClick = {
                    picker.launch(arrayOf("text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                }) { Text("Choose CSV or XLSX") }
                state.preview?.let { preview ->
                    Text("Valid ${preview["validCount"]} · Invalid ${preview["invalidCount"]}")
                    JsonList(preview["rows"] as? JsonArray ?: JsonArray(emptyList()))
                    val id = preview["job"]?.jsonObject?.get("id")?.jsonPrimitive?.content
                    if (id != null && preview["invalidCount"]?.jsonPrimitive?.intOrNull == 0) {
                        Button(onClick = { vm.execute(id) }) { Text("Confirm authoritative import") }
                    }
                }
            }
            "export" -> {
                listOf("customers", "vendors", "items", "projects", "chart-of-accounts").forEach { type ->
                    Row {
                        Text(type, Modifier.weight(1f))
                        Button(onClick = { vm.export(type, "csv") }) { Text("CSV") }
                        Button(onClick = { vm.export(type, "xlsx") }) { Text("XLSX") }
                    }
                }
            }
            "backup" -> Button(onClick = vm::backup) { Text("Generate and share backup") }
            else -> JsonList(state.rows) { id -> confirmRestore = id }
        }
    }

    confirmRestore?.let { id ->
        AlertDialog(
            onDismissRequest = { confirmRestore = null },
            title = { Text("Restore record?") },
            text = { Text("The server will verify conflicts and permissions before restoring.") },
            confirmButton = {
                Button(onClick = { vm.restored(id); confirmRestore = null }) { Text("Restore") }
            },
            dismissButton = { TextButton(onClick = { confirmRestore = null }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun JsonList(rows: JsonArray, onRestore: ((String) -> Unit)? = null) {
    LazyColumn {
        items(rows.toList()) { element ->
            val item = element.jsonObject
            Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text(item["displayName"]?.jsonPrimitive?.content ?: item["fileName"]?.jsonPrimitive?.content ?: item.toString())
                    onRestore?.let { restore ->
                        val id = item["id"]?.jsonPrimitive?.contentOrNull
                        if (id != null) Button(onClick = { restore(id) }) { Text("Restore") }
                    }
                }
            }
        }
    }
}
