package com.salespunch360.mobile.ui.account.admin

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountAdministrationViewModel
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

private const val MAX_SIGNATURE_BYTES = 2 * 1024 * 1024

private suspend fun readSignatureBytes(context: Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
    context.contentResolver.openInputStream(uri)?.use { input ->
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > MAX_SIGNATURE_BYTES) throw IOException("Signature must be 2 MB or smaller.")
            out.write(buffer, 0, count)
        }
        out.toByteArray()
    } ?: throw IOException("Unable to read the selected signature.")
}

@Composable
fun AccountAdministrationScreen(
    mode: String,
    padding: PaddingValues,
    vm: AccountAdministrationViewModel = viewModel()
) {
    val state = vm.state.collectAsStateWithLifecycle().value

    LaunchedEffect(mode) {
        vm.load(mode)
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(16.dp)
    ) {
        Row {
            Text(
                mode.replace('-', ' ').replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = { vm.load(mode) }) {
                Icon(Icons.Default.Refresh, "Refresh")
            }
        }

        if (state.loading) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }

        when (mode) {
            "users" -> UserView(state.data, vm)
            "settings" -> SettingsForm(state.data, vm)
            "general" -> GeneralSettingsView(state.data, vm)
            "transaction-settings" -> SettingsForm(state.data, vm)
            "custom-fields" -> CustomFieldView(state.data, vm)
            "modules" -> ModuleView(state.data, vm)
            "item-settings" -> ItemSettingsView(state.data,vm)
            "print-templates" -> TemplateView(state.data, vm)
            "tax-settings" -> TaxSettingsForm(state.data, vm)
            else -> JsonRows(state.data)
        }
    }
}

@Composable private fun ItemSettingsView(data:JsonElement,vm:AccountAdministrationViewModel){val saved=data.jsonObject["settings"]?.jsonObject?.get("itemSettings")?.jsonObject;var enabled by remember(saved){mutableStateOf(saved?.get("enabled")?.jsonPrimitive?.booleanOrNull?:true)};var units by remember(saved){mutableStateOf(saved?.get("itemUnits")?.jsonPrimitive?.booleanOrNull?:true)};var decimals by remember(saved){mutableStateOf(saved?.get("quantityDecimals")?.jsonPrimitive?.intOrNull?:2)};LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)){item{Text("Supported item behaviour",style=MaterialTheme.typography.titleMedium)};item{SwitchRow("Enable Items",enabled){enabled=it}};item{SwitchRow("Item Units",units){units=it}};item{Text("Quantity decimal places");Slider(decimals.toFloat(),{decimals=it.toInt()},valueRange=0f..4f,steps=3);Text(decimals.toString())};item{ListItem(headlineContent={Text("Manufacturing · Coming Soon")},supportingContent={Text("No manufacturing backend is available.")})};item{Button(onClick={vm.save("item-settings",buildJsonObject{put("enabled",enabled);put("itemUnits",units);put("quantityDecimals",decimals)})}){Text("Save Item Settings")}}}}
@Composable private fun SwitchRow(label:String,checked:Boolean,set:(Boolean)->Unit){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(label);Switch(checked,set)}}

@Composable
private fun SettingsForm(data: JsonElement, vm: AccountAdministrationViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val signaturePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
            val name = uri.lastPathSegment ?: "signature"
            scope.launch {
                runCatching { readSignatureBytes(context, uri) }
                    .onSuccess { bytes -> vm.uploadSignature(name, mime, bytes) }
                    .onFailure { error -> vm.fileError(error.message ?: "Unable to read the selected signature.") }
            }
        }
    }
    val root = data as? JsonObject ?: return
    val current = root["settings"]?.jsonObject ?: JsonObject(emptyMap())
    var due by remember(current) { mutableStateOf(current["transactionDefaults"]?.jsonObject?.get("defaultDueDays")?.jsonPrimitive?.content ?: "0") }
    var sales by remember(current) { mutableStateOf(current["transactionDefaults"]?.jsonObject?.get("salesTerms")?.jsonPrimitive?.content ?: "") }
    var purchase by remember(current) { mutableStateOf(current["transactionDefaults"]?.jsonObject?.get("purchaseTerms")?.jsonPrimitive?.content ?: "") }
    var threshold by remember(current) { mutableStateOf(current["expenseApprovalThreshold"]?.jsonPrimitive?.content ?: "0") }
    var negative by remember(current) { mutableStateOf(current["negativeStockAllowed"]?.jsonPrimitive?.booleanOrNull ?: false) }
    var approval by remember(current) { mutableStateOf(current["expenseApprovalRequired"]?.jsonPrimitive?.booleanOrNull ?: false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(due, { due = it }, label = { Text("Default due days") })
        OutlinedTextField(sales, { sales = it }, label = { Text("Sales terms") })
        OutlinedTextField(purchase, { purchase = it }, label = { Text("Purchase terms") })
        OutlinedTextField(threshold, { threshold = it }, label = { Text("Expense approval threshold") })
        Row { Checkbox(negative, { negative = it }); Text("Allow negative stock") }
        Row { Checkbox(approval, { approval = it }); Text("Expense approval required") }
        Row {
            Button(onClick = { signaturePicker.launch(arrayOf("image/jpeg", "image/png", "image/webp")) }) { Text("Upload signature") }
            TextButton(onClick = vm::removeSignature) { Text("Remove signature") }
        }
        Button(onClick = {
            vm.save("settings", buildJsonObject {
                put("negativeStockAllowed", negative)
                put("expenseApprovalRequired", approval)
                put("expenseApprovalThreshold", threshold)
                putJsonObject("transactionDefaults") {
                    put("defaultDueDays", due.toIntOrNull() ?: 0)
                    put("salesTerms", sales)
                    put("purchaseTerms", purchase)
                }
                putJsonObject("printProfile") {}
            })
        }) { Text("Save authoritative settings") }
    }
}

@Composable
private fun CustomFieldView(data: JsonElement, vm: AccountAdministrationViewModel) {
    val root = data as? JsonObject ?: return
    var key by remember { mutableStateOf("") }
    var label by remember { mutableStateOf("") }
    Column {
        OutlinedTextField(key, { key = it }, label = { Text("Field key") })
        OutlinedTextField(label, { label = it }, label = { Text("Label") })
        Button(onClick = {
            vm.save("custom-fields", buildJsonObject {
                put("entityType", "CUSTOMER")
                put("fieldKey", key)
                put("label", label)
                put("dataType", "TEXT")
                put("isRequired", false)
                put("position", 0)
            })
        }) { Text("Create custom field") }
        JsonRows(root["fields"] ?: JsonArray(emptyList()))
    }
}

@Composable
private fun ModuleView(data: JsonElement, vm: AccountAdministrationViewModel) {
    val root = data as? JsonObject ?: return
    val enabled = root["modules"]?.jsonArray?.map { it.jsonPrimitive.content }?.toSet().orEmpty()
    val types = root["businessTypes"]?.jsonArray?.toList().orEmpty()
    val initialType = root["settings"]?.jsonObject?.get("businessType")?.jsonPrimitive?.content ?: "OTHER_MIXED"
    var selected by remember(root) { mutableStateOf(enabled) }
    var businessType by remember(root) { mutableStateOf(initialType) }
    var typeMenu by remember { mutableStateOf(false) }
    val recommendations = root["recommendations"]?.jsonArray?.map { it.jsonPrimitive.content }?.toSet().orEmpty()
    LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        item {
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text("Step 1",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                    Text("Business Type",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                    Box {
                        OutlinedButton(onClick={typeMenu=true},modifier=Modifier.fillMaxWidth()) {
                            val label=types.firstOrNull{it.jsonObject["key"]?.jsonPrimitive?.content==businessType}?.jsonObject?.get("label")?.jsonPrimitive?.content?:"Other / Mixed"
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(label);Text("⌄")}
                        }
                        DropdownMenu(expanded=typeMenu,onDismissRequest={typeMenu=false}) {
                            types.forEach { type ->
                                val item=type.jsonObject
                                DropdownMenuItem(text={Text(item["label"]!!.jsonPrimitive.content)},onClick={businessType=item["key"]!!.jsonPrimitive.content;typeMenu=false})
                            }
                        }
                    }
                }
            }
        }
        item { Text("Step 2",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold);Text("Modules",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold) }
        items(root["catalog"]?.jsonArray?.toList().orEmpty()) { element ->
            val item = element.jsonObject
            val key = item["key"]!!.jsonPrimitive.content
            val available=item["available"]!!.jsonPrimitive.boolean
            val core=key=="BASIC_ACCOUNTING"
            ElevatedCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().clickable(enabled=available&&!core){selected=if(key in selected)selected-key else selected+key}.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(item["label"]!!.jsonPrimitive.content,fontWeight=FontWeight.SemiBold)
                        val recommended=key in recommendations&&available&&!core
                        Text(item["note"]!!.jsonPrimitive.content+(if(recommended)" · Recommended" else ""),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    when { core->Text("Core",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold);!available->Text("Coming Soon",color=MaterialTheme.colorScheme.onSurfaceVariant);else->Switch(checked=key in selected,onCheckedChange={checked->selected=if(checked)selected+key else selected-key}) }
                }
            }
        }
        item {
            Button(onClick = {
                vm.save("modules", buildJsonObject {
                    put("businessType", businessType)
                    putJsonArray("enabledModules") { selected.forEach { add(it) } }
                })
            },modifier=Modifier.fillMaxWidth()) { Text("Save setup") }
        }
    }
}
@Composable
private fun TemplateView(data: JsonElement, vm: AccountAdministrationViewModel) {
    val root = data as? JsonObject ?: return
    var name by remember { mutableStateOf("") }
    Column {
        OutlinedTextField(name, { name = it }, label = { Text("Template name") })
        Button(onClick = {
            vm.save("print-templates", buildJsonObject {
                put("documentType", "INVOICE")
                put("name", name)
                put("paperSize", "A4")
                put("isDefault", false)
                putJsonObject("config") {
                    put("accentColor", "#075985")
                    put("showBank", true)
                    put("showUpiQr", false)
                    put("showSignature", true)
                    put("footer", "")
                }
            })
        }) { Text("Create invoice template version") }
        JsonRows(root["templates"] ?: JsonArray(emptyList()))
    }
}

@Composable
private fun JsonRows(data: JsonElement) {
    val rows = when (data) {
        is JsonArray -> data
        is JsonObject -> data["rows"] as? JsonArray ?: data["report"]?.jsonObject?.get("rows") as? JsonArray ?: JsonArray(listOf(data))
        else -> JsonArray(emptyList())
    }
    LazyColumn {
        items(rows.toList()) { item ->
            Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(item.toString(), Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun TaxSettingsForm(data: JsonElement, vm: AccountAdministrationViewModel) {
    val root = data as? JsonObject ?: return
    val settings = root["settings"] as? JsonObject ?: JsonObject(emptyMap())
    var registration by remember(settings) { mutableStateOf(settings["gstRegistrationType"]?.jsonPrimitive?.content ?: "UNREGISTERED") }
    var stateCode by remember(settings) { mutableStateOf(settings["defaultStateCode"]?.jsonPrimitive?.content ?: "") }
    var inclusive by remember(settings) { mutableStateOf(settings["defaultTaxMode"]?.jsonPrimitive?.content == "INCLUSIVE") }
    var composition by remember(settings) { mutableStateOf(settings["compositionEnabled"]?.jsonPrimitive?.booleanOrNull ?: false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(registration, { registration = it }, label = { Text("GST registration type") })
        OutlinedTextField(stateCode, { stateCode = it }, label = { Text("Default state code") })
        Row { Checkbox(inclusive, { inclusive = it }); Text("Tax-inclusive pricing") }
        Row { Checkbox(composition, { composition = it }); Text("Composition scheme") }
        Button(onClick = {
            vm.save("tax-settings", buildJsonObject {
                put("gstRegistrationType", registration)
                if (stateCode.isNotBlank()) put("defaultStateCode", stateCode)
                put("compositionEnabled", composition)
                put("defaultTaxMode", if (inclusive) "INCLUSIVE" else "EXCLUSIVE")
            })
        }) { Text("Save tax settings") }
        Text("Branch GST profiles")
        JsonRows(root["branches"] ?: JsonArray(emptyList()))
    }
}

@Composable
private fun UserView(data: JsonElement, vm: AccountAdministrationViewModel) {
    val root = data as? JsonObject ?: return
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("ACCOUNTANT") }
    Column {
        OutlinedTextField(name, { name = it }, label = { Text("Name") })
        OutlinedTextField(email, { email = it }, label = { Text("Email") })
        OutlinedTextField(password, { password = it }, label = { Text("Temporary password") })
        OutlinedTextField(role, { role = it }, label = { Text("Account role") })
        Button(onClick = {
            vm.saveUser(buildJsonObject {
                put("name", name)
                put("email", email)
                put("password", password)
                put("confirmPassword", password)
                put("accountRole", role)
                put("branchAccessScope", "ALL_BRANCHES")
                putJsonArray("branchIds") {}
            })
        }) { Text("Create Account user") }
        Text("Effective roles and access")
        LazyColumn {
            items(root["users"]?.jsonArray?.toList().orEmpty()) { element ->
                val user = element.jsonObject
                Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Text(user["name"]!!.jsonPrimitive.content)
                        Text("${user["accountRole"]?.jsonPrimitive?.contentOrNull ?: "No Account role"} · ${user["branchAccessScope"]?.jsonPrimitive?.content ?: ""}")
                        Button(onClick = {
                            vm.saveUser(buildJsonObject {
                                put("userId", user["id"]!!.jsonPrimitive.content)
                                val accountRole = user["accountRole"]?.jsonPrimitive?.contentOrNull
                                if (accountRole != null) put("accountRole", accountRole) else put("accountRole", JsonNull)
                                put("accountAccessActive", !(user["accountAccessActive"]?.jsonPrimitive?.booleanOrNull ?: false))
                                put("branchAccessScope", user["branchAccessScope"]?.jsonPrimitive?.content ?: "ALL_BRANCHES")
                                putJsonArray("branchIds") {
                                    user["branchAccesses"]?.jsonArray?.forEach { access -> add(access.jsonObject["branchId"]!!.jsonPrimitive.content) }
                                }
                            })
                        }) {
                            Text(if (user["accountAccessActive"]?.jsonPrimitive?.booleanOrNull == true) "Deactivate Account access" else "Reactivate Account access")
                        }
                    }
                }
            }
        }
    }
}

private val accountSettingsDestinations=listOf(
    "General" to "/workspace/account/settings/general","Transaction" to "/workspace/account/settings/transactions","Invoice Print" to "/workspace/account/settings/print-templates","Taxes & GST" to "/workspace/account/tax/settings","User Management" to "/workspace/employees","Transaction SMS" to "/workspace/account/settings/transactions","Reminders" to "/workspace/account/settings/transactions","Party" to "/workspace/account/settings/custom-fields","Item" to "/workspace/account/inventory/item-settings","Multi-Currency" to "/workspace/account/financial-years"
)

@Composable
fun AccountSettingsMenuScreen(padding:PaddingValues,navigate:(String)->Unit,back:()->Boolean){
    var query by remember{mutableStateOf("")}
    val rows=accountSettingsDestinations.filter{it.first.contains(query,true)}
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
        Row(verticalAlignment=Alignment.CenterVertically){TextButton(onClick={back()}){Text("‹ Back")};Text("Settings",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
        OutlinedTextField(query,{query=it},placeholder={Text("Search settings")},singleLine=true,modifier=Modifier.fillMaxWidth())
        LazyColumn(Modifier.weight(1f)){items(rows){item->ListItem(headlineContent={Text(item.first)},leadingContent={Icon(Icons.Default.Settings,null)},trailingContent={Text("›")},modifier=Modifier.clickable{navigate(item.second)});HorizontalDivider()}}
    }
}

@Composable
private fun GeneralSettingsView(data:JsonElement,vm:AccountAdministrationViewModel){
    val context=LocalContext.current
    val current=data.jsonObject["settings"]?.jsonObject?:JsonObject(emptyMap())
    var language by remember(current){mutableStateOf(current["appLanguage"]?.jsonPrimitive?.content?:"en")}
    var currency by remember(current){mutableStateOf(current["baseCurrency"]?.jsonPrimitive?.content?:"INR")}
    var decimals by remember(current){mutableStateOf(current["displayDecimalPlaces"]?.jsonPrimitive?.intOrNull?:2)}
    var dateFormat by remember(current){mutableStateOf(current["dateFormat"]?.jsonPrimitive?.content?:"DD/MM/YYYY")}
    var warning by remember(current){mutableStateOf(current["warnUnsavedChanges"]?.jsonPrimitive?.booleanOrNull?:true)}
    var appearance by remember(current){mutableStateOf(current["appearance"]?.jsonPrimitive?.content?:"SYSTEM")}
    LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)){
        item{Text("Application",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
        item{ChoiceSetting("App Language",language,listOf("en" to "English","hi" to "Hindi")){language=it}}
        item{ChoiceSetting("Business Currency",currency,listOf("INR","USD","EUR","GBP","AED").map{it to it}){currency=it}}
        item{ChoiceSetting("Decimal Places",decimals.toString(),(0..4).map{it.toString() to it.toString()}){decimals=it.toInt()};Text("General amount precision; item quantity decimals remain in Item Settings.",style=MaterialTheme.typography.bodySmall)}
        item{ChoiceSetting("Date Format",dateFormat,listOf("DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD").map{it to it}){dateFormat=it}}
        item{SwitchRow("Show warning for unsaved changes",warning){warning=it}}
        item{ChoiceSetting("Theme / Appearance",appearance,listOf("SYSTEM" to "Use device setting","LIGHT" to "Light","DARK" to "Dark")){appearance=it}}
        item{Text("Security",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);ListItem(headlineContent={Text("Passcode / Fingerprint")},supportingContent={Text("Managed by Android device security")},trailingContent={Text("›")},modifier=Modifier.clickable{context.startActivity(android.content.Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS))})}
        item{Button(onClick={vm.save("general",buildJsonObject{put("appLanguage",language);put("baseCurrency",currency);put("displayDecimalPlaces",decimals);put("dateFormat",dateFormat);put("warnUnsavedChanges",warning);put("appearance",appearance)})},modifier=Modifier.fillMaxWidth()){Text("Save General Settings")}}
    }
}

@Composable
private fun ChoiceSetting(label:String,value:String,choices:List<Pair<String,String>>,change:(String)->Unit){var open by remember{mutableStateOf(false)};Box{OutlinedButton(onClick={open=true},modifier=Modifier.fillMaxWidth()){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(label);Text(choices.firstOrNull{it.first==value}?.second?:value)}};DropdownMenu(expanded=open,onDismissRequest={open=false}){choices.forEach{choice->DropdownMenuItem(text={Text(choice.second)},onClick={change(choice.first);open=false})}}}}
