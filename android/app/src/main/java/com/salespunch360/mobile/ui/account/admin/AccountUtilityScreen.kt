package com.salespunch360.mobile.ui.account.admin

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import java.io.ByteArrayOutputStream
import java.io.File
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

private const val MAX_IMPORT_BYTES = 10L * 1024L * 1024L

private suspend fun readImportBytes(context: android.content.Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
    val declaredSize = context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getLong(0).takeIf { it >= 0L } else null
    }
    if (declaredSize != null && declaredSize > MAX_IMPORT_BYTES) throw IllegalArgumentException("Import file is larger than 10 MB.")
    val stream = context.contentResolver.openInputStream(uri) ?: throw IllegalArgumentException("The selected file could not be opened.")
    stream.use { input ->
        val output = ByteArrayOutputStream(if (declaredSize != null) minOf(declaredSize, MAX_IMPORT_BYTES).toInt() else 32 * 1024)
        val buffer = ByteArray(32 * 1024)
        var total = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            if (total > MAX_IMPORT_BYTES) throw IllegalArgumentException("Import file is larger than 10 MB.")
            output.write(buffer, 0, read)
        }
        if (total == 0L) throw IllegalArgumentException("Import file is empty.")
        output.toByteArray()
    }
}

@Composable
fun AccountUtilityScreen(
    mode: String,
    padding: PaddingValues,
    vm: AccountUtilityViewModel = viewModel(),
    initialImportType: String = "CUSTOMERS",
    initialExportType: String? = null,
    backupMode: String? = null
) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var importType by remember(mode, initialImportType) { mutableStateOf(initialImportType.takeIf { it in listOf("CUSTOMERS", "VENDORS", "ITEMS", "PROJECTS", "OPENING_BALANCES") } ?: "CUSTOMERS") }
    var confirmRestore by remember { mutableStateOf<String?>(null) }
    var fileMessage by remember { mutableStateOf<String?>(null) }
    var fileBusy by remember { mutableStateOf(false) }
    var updateExisting by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null && !fileBusy) {
            val name = uri.lastPathSegment?.substringAfterLast('/') ?: "import.csv"
            val mime = context.contentResolver.getType(uri) ?: if (name.endsWith(".xlsx", true)) {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            } else {
                "text/csv"
            }
            fileBusy = true
            fileMessage = null
            scope.launch {
                try {
                    val bytes = readImportBytes(context, uri)
                    vm.upload(importType, name, mime, bytes, updateExisting)
                } catch (e: Exception) {
                    fileMessage = e.message ?: "The selected file could not be read."
                } finally {
                    fileBusy = false
                }
            }
        }
    }

    val saveBackup = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val downloadable = state.file
        if(uri == null) { fileMessage = "Backup save cancelled."; vm.consumed() }
        else if(downloadable != null) {
            fileBusy = true
            scope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        val output = context.contentResolver.openOutputStream(uri, "w") ?: throw IllegalStateException("Could not open the selected file.")
                        output.buffered().use { it.write(downloadable.second) }
                    }
                    fileMessage = "Backup saved to the selected location."
                    vm.savedBackup(downloadable.second)
                } catch(_:Exception) { fileMessage = "Backup could not be saved. Please retry." }
                finally { fileBusy = false; vm.consumed() }
            }
        }
    }

    var restoreName by remember { mutableStateOf("") }
    var replaceConfirmed by remember { mutableStateOf(false) }
    val restorePicker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->
        if(uri!=null){fileBusy=true;fileMessage=null;scope.launch{
            var staged:File?=null
            try{
                val ready=withContext(Dispatchers.IO){
                    val target=File.createTempFile("restore-upload-",".json",context.cacheDir)
                    try{context.contentResolver.openInputStream(uri)?.use{input->target.outputStream().buffered().use{output->val buffer=ByteArray(32768);var total=0L;while(true){val count=input.read(buffer);if(count<0)break;total+=count;if(total>128L*1024*1024)throw IllegalArgumentException("Choose a backup no larger than 128 MiB.");output.write(buffer,0,count)};if(total==0L)throw IllegalArgumentException("The backup file is empty.")}}?:throw IllegalArgumentException("Could not open the backup file.");target}catch(error:Exception){target.delete();throw error}
                }
                staged=ready
                restoreName="";replaceConfirmed=false;vm.prepareRestore(ready)
            }catch(error:Exception){staged?.delete();fileMessage=error.message?:"Could not read the backup file."}
            finally{fileBusy=false}
        }}
    }

    LaunchedEffect(mode) { vm.load(mode) }

    LaunchedEffect(state.file) {
        state.file?.let { downloadable ->
            if(mode == "backup" && backupMode == "phone") {
                try { saveBackup.launch(downloadable.first) } catch(_:Exception) { fileMessage = "Could not open the file picker."; vm.consumed() }
                return@let
            }
            try {
                val file = withContext(Dispatchers.IO) {
                    context.cacheDir.listFiles()?.filter { it.name.matches(Regex("^[0-9a-f-]{36}-.*")) && System.currentTimeMillis()-it.lastModified()>24*60*60*1000L }?.forEach { it.delete() }
                    File(context.cacheDir, "${java.util.UUID.randomUUID()}-${downloadable.first.substringAfterLast('/')}").also { target ->
                        target.outputStream().buffered().use { it.write(downloadable.second) }
                    }
                }
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                val mime = if (file.extension == "xlsx") {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                } else if(file.extension == "csv") { "text/csv" } else {
                    "application/json"
                }
                val send = Intent(Intent.ACTION_SEND)
                    .setType(mime)
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                context.startActivity(Intent.createChooser(send, "Share ${file.name}"))
            } catch (e: Exception) {
                fileMessage = e.message ?: "The exported file could not be prepared."
            } finally {
                vm.consumed()
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
        Text(mode.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.headlineSmall)
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        fileMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }

        when (mode) {
            "import" -> {
                Row { Checkbox(updateExisting,{if(!state.loading)updateExisting=it},enabled=!state.loading);Text("Update matching existing records") }
                Row {
                    listOf("CUSTOMERS", "VENDORS", "ITEMS", "PROJECTS", "OPENING_BALANCES").forEach { type ->
                        FilterChip(importType == type, { importType = type }, { Text(type) })
                    }
                }
                Button(
                    enabled = !fileBusy && !state.loading,
                    onClick = { picker.launch(arrayOf("text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel")) }
                ) { Text(if (fileBusy) "Reading file…" else "Choose CSV, XLSX or XLS") }
                Text("Maximum import size: 10 MB", style = MaterialTheme.typography.bodySmall)
                if (fileBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.preview?.let { preview ->
                    Text("Valid ${preview["validCount"]} · Invalid ${preview["invalidCount"]}")
                    ImportRows(preview["rows"] as? JsonArray ?: JsonArray(emptyList()))
                    val id = preview["job"]?.jsonObject?.get("id")?.jsonPrimitive?.content
                    if (id != null && preview["invalidCount"]?.jsonPrimitive?.intOrNull == 0 && preview["job"]?.jsonObject?.get("status")?.jsonPrimitive?.content == "READY") {
                        Button(enabled=!state.loading,onClick = { vm.execute(id) }) { Text("Confirm authoritative import") }
                    }
                }
            }
            "export" -> {
                Text("Reporting exports contain names and current-company references. For importing, use the selected import template and review every row; project names are not portable identifiers.")
                state.exportTypes.filter { initialExportType == null || initialExportType !in listOf("customers", "vendors", "items", "projects", "chart-of-accounts") || it == initialExportType }.forEach { type ->
                    Row {
                        Text(type, Modifier.weight(1f))
                        Button(enabled=!state.loading,onClick = { vm.export(type, "csv") }) { Text("CSV") }
                        Button(enabled=!state.loading,onClick = { vm.export(type, "xlsx") }) { Text("XLSX") }
                    }
                }
            }
            "backup" -> Column(Modifier.verticalScroll(rememberScrollState())) {
                if(backupMode=="restore") {
                    Text("Restore backup")
                    Text("Replace this existing company with the exact saved backup state. Entries and changes after that backup will be removed. No new company is created.")
                    Text("The primary company administrator with all-branch access must confirm. Logins, user accounts, subscriptions and recovery records are retained.")
                    Button(enabled=!state.loading&&!fileBusy,onClick={restorePicker.launch(arrayOf("application/json","application/octet-stream"))}){Text(if(fileBusy)"Reading backup…" else "Choose and validate backup")}
                    state.restoreReview?.let{review->
                        val company=review["companyName"]?.jsonPrimitive?.content.orEmpty()
                        val id=review["id"]?.jsonPrimitive?.content.orEmpty()
                        Text("Company: $company",style=MaterialTheme.typography.titleMedium)
                        Text("Backup taken: ${review["backupDate"]?.jsonPrimitive?.content}")
                        (review["counts"] as? JsonArray)?.filter{it.jsonObject["current"]!=it.jsonObject["restored"]}?.forEach{entry->val row=entry.jsonObject;Text("${row["model"]?.jsonPrimitive?.content}: ${row["current"]} current → ${row["restored"]} saved")}
                        Text("A private file-inclusive safety copy is saved before replacement. Public quotation share links are revoked. If current data changes, review again.")
                        OutlinedTextField(restoreName,{restoreName=it},label={Text("Type $company to confirm")},enabled=!state.loading)
                        Row{Checkbox(replaceConfirmed,{replaceConfirmed=it},enabled=!state.loading);Text("I understand that entries and changes after the backup will be removed.")}
                        Button(enabled=!state.loading&&replaceConfirmed&&restoreName==company&&id.isNotBlank(),onClick={vm.executeRestore(id,restoreName)}){Text(if(state.loading)"Restoring…" else "Replace existing company data")}
                    }
                } else {
                Button(enabled=!state.loading && !fileBusy,onClick = {vm.backup()}) { Text(if(backupMode=="phone") "Generate and save backup" else "Generate and share backup") }
                Text("Include live uploaded files and signatures, up to 64 MiB. Missing files stop generation. Provider backups are still required for full recovery.")
                Button(enabled=!state.loading && !fileBusy,onClick = {vm.backup(true)}) { Text(if(backupMode=="phone") "Save records and private files" else "Share records and private files") }
                }
            }
            else -> JsonList(state.rows) { id -> confirmRestore = id }
        }
    }

    confirmRestore?.let { id ->
        AlertDialog(
            onDismissRequest = { confirmRestore = null },
            title = { Text("Restore record?") },
            text = { Text("The server will verify conflicts and permissions before restoring.") },
            confirmButton = { Button(onClick = { vm.restored(id); confirmRestore = null }) { Text("Restore") } },
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

@Composable
private fun ImportRows(rows: JsonArray) {
    LazyColumn(Modifier.heightIn(max=360.dp)) {
        items(rows.toList()) { element ->
            val row=element.jsonObject
            Card(Modifier.fillMaxWidth().padding(vertical=4.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text("Row ${row["rowNumber"]} · ${row["action"]?.jsonPrimitive?.content}", style=MaterialTheme.typography.titleSmall)
                    (row["values"] as? JsonObject)?.forEach { (key,value) -> Text("${key.replace('_',' ')}: ${value.jsonPrimitive.content}") }
                    (row["resolved"] as? JsonObject)?.get("existingId")?.let{ Text("Matched record: ${it.jsonPrimitive.content}") }
                    listOf("errors","warnings").forEach { key -> (row[key] as? JsonArray)?.forEach{ Text(it.jsonPrimitive.content) } }
                }
            }
        }
    }
}
