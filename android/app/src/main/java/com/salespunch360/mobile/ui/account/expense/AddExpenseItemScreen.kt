package com.salespunch360.mobile.ui.account.expense

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.platform.LocalContext
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*
import java.util.UUID
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

/** Creates reusable company items without posting the enclosing expense. */
@Composable
internal fun AddExpenseItemScreen(onClose: () -> Unit, onSave: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    val context = LocalContext.current
    val api = remember { ApiClient(SecureSession(context)) }
    val scope = rememberCoroutineScope()
    val requestKey = remember { UUID.randomUUID().toString() }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var matches by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var photoName by remember { mutableStateOf<String?>(null) }
    var photoMime by remember { mutableStateOf<String?>(null) }
    var photo by remember { mutableStateOf<ByteArray?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if(uri!=null&&!saving) scope.launch {
            try {
                val (filename,mime,bytes) = readExpenseAttachment(context,uri)
                if(bytes.size>5*1024*1024||!mime.startsWith("image/")) throw IllegalArgumentException()
                photoName=filename; photoMime=mime; photo=bytes; error=null
            } catch(_:Exception) { error="Select a valid image smaller than 5 MB." }
        }
    }
    LaunchedEffect(name) {
        matches=emptyList(); delay(250)
        try { matches=(api.expenseItems(name)["rows"] as? JsonArray)?.map{it.jsonObject}.orEmpty() }
        catch(e:kotlinx.coroutines.CancellationException){throw e}
        catch(_:Exception){error="Expense items could not be loaded. Try again."}
    }
    val focus = remember { FocusRequester() }
    Dialog(onDismissRequest = {if(!saving)onClose()}, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                Row(Modifier.fillMaxWidth().padding(16.dp)) {
                    IconButton(onClose,enabled=!saving) { Icon(Icons.Default.ArrowBack, "Back to expense") }
                    Text("Add Expense Item", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 10.dp))
                    OutlinedButton({picker.launch("image/*")},enabled=!saving){Text(photoName?:"Add item photo (optional)")}
                    error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
                    if(matches.isNotEmpty())Text("Saved expense items")
                    matches.forEach { item -> TextButton({onSave(item["name"]!!.jsonPrimitive.content)},enabled=!saving){Text(item["name"]!!.jsonPrimitive.content)} }
                }
                HorizontalDivider()
                Column(Modifier.weight(1f).padding(16.dp).verticalScroll(rememberScrollState())) {
                    OutlinedTextField(
                        name, { if (it.length <= 240) name = it },
                        label = { Text("Item name *") }, singleLine = true, enabled=!saving,
                        modifier = Modifier.fillMaxWidth().focusRequester(focus),
                    )
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClose, enabled=!saving, modifier = Modifier.weight(1f)) { Text("Cancel") }
                    Button({ if(!saving)scope.launch {
                        saving=true;error=null
                        try { val item=api.saveExpenseItem(name.trim(),requestKey,photoName,photoMime,photo);onSave(item["name"]!!.jsonPrimitive.content) }
                        catch(e:kotlinx.coroutines.CancellationException){throw e}
                        catch(_:Exception){error="Expense item could not be saved. Check the name/photo or select an existing item."}
                        finally{saving=false}
                    } }, enabled = !saving&&name.isNotBlank(), modifier = Modifier.weight(1f)) { Text(if(saving)"Saving…"else "Save item") }
                }
            }
        }
        LaunchedEffect(Unit) { focus.requestFocus() }
    }
}
