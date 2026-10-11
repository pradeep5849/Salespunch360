package com.salespunch360.mobile.ui.account.admin

import com.salespunch360.mobile.ui.account.accountLabel
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
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.ui.account.sales.SelectField
import com.salespunch360.mobile.ui.MutationFeedback
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
    navigate:(String)->Unit={},
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
        MutationFeedback(state.message,state.error,vm::consumeFeedback)
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

        when (mode) {
            "users" -> UserView(state.data, vm)
            "settings" -> SettingsForm(state.data, vm)
            "general" -> androidx.compose.runtime.CompositionLocalProvider(com.salespunch360.mobile.ui.account.LocalAccountDisplayPreferences provides com.salespunch360.mobile.ui.account.AccountDisplayPreferences.from(state.data.jsonObject["settings"]?.jsonObject)){GeneralSettingsView(state.data, vm,navigate)}
            "party-settings" -> PartySettingsView(state.data,vm,navigate,state.loading)
            "party-additional-fields" -> PartyAdditionalFieldsView(state.data,vm,state.loading)
            "transaction-sms" -> TransactionSmsView(state.data,vm,state.loading)
            "business-currency" -> BusinessCurrencyView(state.data,vm,state.loading)
            "transaction-settings" -> TransactionSettingsForm(state.data, vm,navigate)
            "transaction-defaults" -> TransactionDefaultsView(state.data,vm,state.loading)
            "backup-settings" -> BackupSettingsView(state.data,vm,navigate)
            "notifications" -> AttentionView(state.data,navigate,vm::completeServiceReminder,state.loading)
            "custom-fields" -> CustomFieldView(state.data, vm,state.loading)
            "modules" -> ModuleView(state.data, vm,state.loading)
            "item-settings" -> ItemSettingsView(state.data,vm)
            "print-templates" -> InvoicePrintSettingsView(state.data, vm)
            "reminders" -> ReminderLandingView(navigate)
            "payment-reminders" -> PaymentReminderView(state.data,vm,navigate)
            "payment-reminder-message" -> PaymentReminderMessageView(state.data,vm)
            "service-reminders" -> ServiceReminderView({ navigate("/workspace/account/settings/reminders") })
            "tax-settings" -> TaxPreferencesView(state.data,vm,navigate)
            "tax-list" -> TaxListView()
            else -> JsonRows(state.data)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ItemSettingsView(data:JsonElement,vm:AccountAdministrationViewModel){
    val saved=data.jsonObject["settings"]?.jsonObject?.get("itemSettings")?.jsonObject
    fun bool(key:String,default:Boolean)=saved?.get(key)?.jsonPrimitive?.booleanOrNull?:default
    var enabled by remember(saved){mutableStateOf(bool("enabled",true))}
    var itemType by remember(saved){mutableStateOf(saved?.get("itemType")?.jsonPrimitive?.content?:"BOTH")}
    var barcode by remember(saved){mutableStateOf(bool("barcodeScanning",false))}
    var stock by remember(saved){mutableStateOf(bool("stockMaintenance",true))}
    var units by remember(saved){mutableStateOf(bool("itemUnits",true))}
    var defaultUnit by remember(saved){mutableStateOf(saved?.get("defaultUnit")?.jsonPrimitive?.content.orEmpty())}
    var category by remember(saved){mutableStateOf(bool("itemCategory",true))}
    var partyRate by remember(saved){mutableStateOf(bool("partyWiseRate",true))}
    var wholesale by remember(saved){mutableStateOf(bool("wholesalePrice",true))}
    var decimals by remember(saved){mutableStateOf(saved?.get("quantityDecimals")?.jsonPrimitive?.intOrNull?:2)}
    var itemTax by remember(saved){mutableStateOf(bool("itemWiseTax",true))}
    var taxOnMrp by remember(saved){mutableStateOf(bool("taxOnMrp",false))}
    var itemDiscount by remember(saved){mutableStateOf(bool("itemWiseDiscount",true))}
    var updateSale by remember(saved){mutableStateOf(bool("updateSalePrice",false))}
    var additionalFields by remember(saved){mutableStateOf(bool("additionalFields",true))}
    var customFields by remember(saved){mutableStateOf(bool("customFields",true))}
    var description by remember(saved){mutableStateOf(bool("description",true))}
    var hsn by remember(saved){mutableStateOf(bool("hsnSac",true))}
    var cess by remember(saved){mutableStateOf(bool("additionalCess",true))}
    var typeOpen by remember{mutableStateOf(false)}
    LazyColumn(contentPadding=PaddingValues(bottom=90.dp),verticalArrangement=Arrangement.spacedBy(0.dp)){
        item{SwitchRow("Enable Item",enabled){enabled=it}}
        item{
            ExposedDropdownMenuBox(expanded=typeOpen,onExpandedChange={typeOpen=it}){
                OutlinedTextField(
                    value=when(itemType){"PRODUCTS"->"Products";"SERVICES"->"Services";else->"Products and Services"},
                    onValueChange={},
                    readOnly=true,
                    label={Text("Item Type")},
                    modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                )
                ExposedDropdownMenu(expanded=typeOpen,onDismissRequest={typeOpen=false}){
                    listOf("PRODUCTS" to "Products","SERVICES" to "Services","BOTH" to "Products and Services").forEach{(value,label)->
                        DropdownMenuItem({Text(label)},{itemType=value;typeOpen=false})
                    }
                }
            }
        }
        item{SwitchRow("Barcode scanning for items",barcode){barcode=it}}
        item{SwitchRow("Stock maintenance",stock){stock=it}}
        item{SwitchRow("Manufacturing",false,enabled=false){}}
        item{SwitchRow("Item Units",units){units=it;if(!it)defaultUnit=""}}
        item{
            OutlinedTextField(defaultUnit,{if(it.length<=40)defaultUnit=it},label={Text("Default Unit")},placeholder={Text("For example, PCS")},enabled=units,modifier=Modifier.fillMaxWidth(),singleLine=true)
        }
        item{SwitchRow("Item Category",category){category=it}}
        item{SwitchRow("Party wise item rate",partyRate){partyRate=it}}
        item{SwitchRow("Wholesale Price",wholesale){wholesale=it}}
        item{
            Row(Modifier.fillMaxWidth().padding(vertical=10.dp),verticalAlignment=Alignment.CenterVertically){
                Text("Quantity (Upto Decimal places)",Modifier.weight(1f))
                IconButton(onClick={if(decimals>0)decimals--}){Text("−")}
                Text(decimals.toString(),style=MaterialTheme.typography.titleMedium)
                IconButton(onClick={if(decimals<4)decimals++}){Text("+")}
            }
        }
        item{SwitchRow("Item wise tax",itemTax){itemTax=it}}
        item{SwitchRow("Calculate tax based on MRP",taxOnMrp){taxOnMrp=it}}
        item{SwitchRow("Item wise discount",itemDiscount){itemDiscount=it}}
        item{SwitchRow("Update sale price from transaction",updateSale){updateSale=it}}
        item{SwitchRow("Additional Item Fields",additionalFields){additionalFields=it}}
        item{SwitchRow("Item Custom Fields",customFields){customFields=it}}
        item{SwitchRow("Description",description){description=it}}
        item{SwitchRow("HSN/SAC Code",hsn){hsn=it}}
        item{SwitchRow("Additional CESS",cess){cess=it}}
        item{
            Button(
                onClick={vm.save("item-settings",buildJsonObject{
                    put("enabled",enabled);put("itemType",itemType);put("barcodeScanning",barcode);put("stockMaintenance",stock);put("itemUnits",units);put("defaultUnit",defaultUnit);put("itemCategory",category);put("partyWiseRate",partyRate);put("wholesalePrice",wholesale);put("quantityDecimals",decimals);put("itemWiseTax",itemTax);put("taxOnMrp",taxOnMrp);put("itemWiseDiscount",itemDiscount);put("updateSalePrice",updateSale);put("additionalFields",additionalFields);put("customFields",customFields);put("description",description);put("hsnSac",hsn);put("additionalCess",cess)
                })},
                modifier=Modifier.fillMaxWidth().padding(top=12.dp)
            ){Text("Save Item Settings")}
        }
    }
}
@Composable
private fun SwitchRow(label:String,checked:Boolean,enabled:Boolean=true,set:(Boolean)->Unit){
    Row(Modifier.fillMaxWidth().padding(vertical=6.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
        Text(label,Modifier.weight(1f))
        Switch(checked=checked,onCheckedChange=if(enabled)set else null,enabled=enabled)
    }
}



private val transactionSettingGroups=listOf(
    "TRANSACTION HEADER" to listOf("showInvoiceNumber" to "Invoice/Bill Number","cashSaleByDefault" to "Cash Sale by default","billingName" to "Billing name of Parties","customerPoDetails" to "PO Details (of customer)","transactionTime" to "Add Time On Transactions"),
    "ITEMS TABLE" to listOf("rateTaxMode" to "Allow Inclusive/Exclusive tax on Rate (Price/unit)","displayPurchasePrice" to "Display Purchase Price","lastFiveSalePrices" to "Show Last 5 Sale Price of Items","freeItemQuantity" to "Free Item quantity","itemCount" to "Count","barcodeScanning" to "Barcode scanning for items"),
    "TAXES, DISCOUNT & TOTAL" to listOf("transactionTax" to "Transaction wise Tax","transactionDiscount" to "Transaction wise Discount","roundOff" to "Round Off Transaction amount"),
    "MORE TRANSACTION FEATURES" to listOf("discountDuringPayment" to "Discount during Payment","linkPayments" to "Link Payments to Invoices","invoicePreview" to "Enable Invoice Preview","termsEnabled" to "Terms & Conditions","showProfit" to "Show Profit while making Sale Invoice"),
    "GST" to listOf("reverseCharge" to "Reverse Charge","stateOfSupply" to "State of Supply","ewayBillNumber" to "E-Way Bill No.")
)
private val transactionPrefixes=listOf("SALES_INVOICE" to "Sale invoices","CREDIT_NOTE" to "Credit Note","SALES_ORDER" to "Sale Order","PURCHASE_ORDER" to "Purchase Order","ESTIMATE" to "Estimate","PROFORMA_INVOICE" to "Proforma Invoice","DELIVERY_CHALLAN" to "Delivery Challan","CUSTOMER_RECEIPT" to "Payment-In")

@Composable private fun TransactionSettingsForm(data:JsonElement,vm:AccountAdministrationViewModel,navigate:(String)->Unit){
    val root=data as? JsonObject?:return;val settings=root["settings"]?.jsonObject?:JsonObject(emptyMap());val stored=settings["transactionDefaults"]?.jsonObject?.get("transactionPreferences")?.jsonObject?:JsonObject(emptyMap());val branches=root["branches"]?.jsonArray.orEmpty().filter{it.jsonObject["isActive"]?.jsonPrimitive?.booleanOrNull!=false};var branchId by remember(branches){mutableStateOf(branches.firstOrNull()?.jsonObject?.get("id")?.jsonPrimitive?.content.orEmpty())};val defaults=mapOf("showInvoiceNumber" to true,"billingName" to true,"rateTaxMode" to true,"transactionTax" to true,"transactionDiscount" to true,"linkPayments" to true,"invoicePreview" to true,"termsEnabled" to true,"reverseCharge" to true,"stateOfSupply" to true);var values by remember(stored){mutableStateOf(transactionSettingGroups.flatMap{it.second}.associate{it.first to (stored[it.first]?.jsonPrimitive?.booleanOrNull?:defaults.getOrDefault(it.first,false))})};var roundStep by remember(stored){mutableStateOf(stored["roundingStep"]?.jsonPrimitive?.content?:"1")};var shareAs by remember(stored){mutableStateOf(stored["shareAs"]?.jsonPrimitive?.content?:"ASK")};val prefixRows=root["numberingSeries"]?.jsonArray.orEmpty();var prefixes by remember(prefixRows,branchId){mutableStateOf(transactionPrefixes.associate{item->item.first to (prefixRows.firstOrNull{row->row.jsonObject["branchId"]?.jsonPrimitive?.content==branchId&&row.jsonObject["seriesKey"]?.jsonPrimitive?.content==item.first}?.jsonObject?.get("prefix")?.jsonPrimitive?.content?:"")})}
    LazyColumn(verticalArrangement=Arrangement.spacedBy(4.dp),contentPadding=PaddingValues(bottom=80.dp)){
        item{ChoiceSetting("Firm / company branch",branchId,branches.map{row->val branch=row.jsonObject;(branch["id"]?.jsonPrimitive?.content.orEmpty()) to (branch["name"]?.jsonPrimitive?.content.orEmpty())},enabled=branches.isNotEmpty()){branchId=it}}
        transactionSettingGroups.forEach{group->item{Text(group.first,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=14.dp,bottom=5.dp))};items(group.second){entry->SwitchRow(entry.second,values[entry.first]?:false){checked->values=values+(entry.first to checked)}};if(group.first=="TAXES, DISCOUNT & TOTAL")item{OutlinedTextField(roundStep,{roundStep=it},label={Text("Nearest · To")},isError=roundStep.toDoubleOrNull()?.let{it.isFinite()&&it>0&&it<=100}!=true,supportingText={Text("Enter a rounding step greater than 0 and at most 100.")})};if(group.first=="MORE TRANSACTION FEATURES"){item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("Share Transaction as");TextButton(onClick={shareAs=if(shareAs=="ASK")"PDF" else "ASK"}){Text(if(shareAs=="ASK")"Ask me Everytime" else "PDF")}}};item{ListItem(headlineContent={Text("Passcode for edit/delete")},supportingContent={Text("Secure passcode support required")},trailingContent={Switch(false,null)})};items(listOf("Due Dates and Payment terms","Set Terms & Conditions","Additional Fields")){label->ListItem(headlineContent={Text(label)},trailingContent={Text("›")},modifier=Modifier.clickable{navigate(if(label=="Additional Fields")"/workspace/account/settings/custom-fields" else "/workspace/account/settings/transactions/defaults")})}}}
        item{Text("TRANSACTION PREFIXES",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=14.dp,bottom=5.dp))};items(transactionPrefixes){entry->OutlinedTextField(prefixes[entry.first].orEmpty(),{if(it.length<=30)prefixes=prefixes+(entry.first to it)},label={Text(entry.second+" prefix")},modifier=Modifier.fillMaxWidth())};item{Button(enabled=branchId.isNotBlank()&&roundStep.toDoubleOrNull()?.let{it.isFinite()&&it>0&&it<=100}==true,onClick={vm.save("transaction-settings",buildJsonObject{putJsonObject("preferences"){values.forEach{put(it.key,it.value)};put("shareAs",shareAs);put("roundingMode","NEAREST");put("roundingStep",roundStep.toDoubleOrNull()?:1.0)};put("branchId",branchId);putJsonObject("prefixes"){prefixes.forEach{put(it.key,it.value)}}})},modifier=Modifier.fillMaxWidth()){Text("Save Transaction Settings")}}
    }
}

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
private fun CustomFieldView(data: JsonElement, vm: AccountAdministrationViewModel,busy:Boolean) {
    val root = data as? JsonObject ?: return
    var editing by remember(root){mutableStateOf<JsonObject?>(null)}
    var entity by remember(editing){mutableStateOf(editing?.str("entityType")?:"CUSTOMER")}
    var key by remember(editing){mutableStateOf(editing?.str("fieldKey").orEmpty())}
    var label by remember(editing){mutableStateOf(editing?.str("label").orEmpty())}
    var type by remember(editing){mutableStateOf(editing?.str("dataType")?:"TEXT")}
    var choices by remember(editing){mutableStateOf((editing?.get("options") as? JsonArray).orEmpty().joinToString(", "){it.jsonPrimitive.content})}
    var required by remember(editing){mutableStateOf(editing?.get("isRequired")?.jsonPrimitive?.booleanOrNull?:false)}
    var active by remember(editing){mutableStateOf(editing?.get("isActive")?.jsonPrimitive?.booleanOrNull?:true)}
    var printing by remember(editing){mutableStateOf((editing?.get("validation") as? JsonObject)?.get("showInPrint")?.jsonPrimitive?.booleanOrNull?:false)}
    var position by remember(editing){mutableStateOf(editing?.str("position")?:"0")}
    LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        item{Text(if(editing==null)"Create custom field" else "Edit custom field",fontWeight=FontWeight.Bold)}
        item{SelectField("Entity",entity,listOf("CUSTOMER","VENDOR","PRODUCT","SERVICE","PROJECT","ASSET","QUOTATION","SALES_INVOICE","PURCHASE_BILL").map{it to it.replace('_',' ')}){if(!busy&&editing==null)entity=it}}
        item{OutlinedTextField(key,{key=it},enabled=!busy&&editing==null,label={Text("Field key")})}
        item{OutlinedTextField(label,{label=it},enabled=!busy,label={Text("Label")})}
        item{SelectField("Type",type,listOf("TEXT","TEXTAREA","NUMBER","DECIMAL","DATE","BOOLEAN","SELECT").map{it to it}){if(!busy&&editing==null)type=it}}
        if(type=="SELECT")item{OutlinedTextField(choices,{choices=it},enabled=!busy,label={Text("Options, comma separated")})}
        item{OutlinedTextField(position,{position=it},enabled=!busy,label={Text("Position")})}
        item{SwitchRow("Required",required,!busy){required=it};SwitchRow("Show in print",printing,!busy){printing=it};if(editing!=null)SwitchRow("Active",active,!busy){active=it}}
        item{Button(enabled=!busy&&key.matches(Regex("[a-z][a-z0-9_]{1,59}"))&&label.isNotBlank()&&label.length<=100&&position.toIntOrNull() in 0..1000&&(type!="SELECT"||choices.split(',').any{it.isNotBlank()}),onClick={
            vm.save("custom-fields",buildJsonObject{
                editing?.str("id")?.let{put("id",it)};put("entityType",entity);put("fieldKey",key);put("label",label);put("dataType",type);put("isRequired",required);put("showInPrint",printing);put("isActive",active);put("position",position.toInt());if(type=="SELECT")putJsonArray("options"){choices.split(',').map{it.trim()}.filter{it.isNotBlank()}.forEach{add(JsonPrimitive(it))}}
            })
        }){Text(if(busy)"Saving…" else if(editing==null)"Create field" else "Save field")};if(editing!=null)TextButton(enabled=!busy,onClick={editing=null}){Text("Cancel edit")}}
        items((root["fields"] as? JsonArray).orEmpty()){value->val field=value.jsonObject;ListItem(headlineContent={Text(field.str("label"))},supportingContent={Text("${field.str("entityType")} · ${field.str("dataType")} · ${if(field["isActive"]?.jsonPrimitive?.booleanOrNull==true)"ACTIVE" else "INACTIVE"}")},trailingContent={TextButton(enabled=!busy,onClick={editing=field}){Text("Edit")}})}
    }
}

@Composable
private fun ModuleView(data: JsonElement, vm: AccountAdministrationViewModel,busy:Boolean) {
    val root = data as? JsonObject ?: return
    val enabled = root["modules"]?.jsonArray?.map { it.jsonPrimitive.content }?.toSet().orEmpty()
    val types = root["businessTypes"]?.jsonArray?.toList().orEmpty()
    val initialType = root["settings"]?.jsonObject?.get("businessType")?.jsonPrimitive?.content ?: "OTHER_MIXED"
    var selected by remember(root) { mutableStateOf(enabled) }
    var businessType by remember(root) { mutableStateOf(initialType) }
    var typeMenu by remember { mutableStateOf(false) }
    val recommendations = (root["recommendationsByBusinessType"]?.jsonObject?.get(businessType) ?: root["recommendations"])?.jsonArray?.map { it.jsonPrimitive.content }?.toSet().orEmpty()
    LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        item {
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text("Step 1",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                    Text("Business Type",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                    Box {
                        OutlinedButton(onClick={typeMenu=true},enabled=!busy,modifier=Modifier.fillMaxWidth()) {
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
                Row(Modifier.fillMaxWidth().clickable(enabled=available&&!core&&!busy){selected=if(key in selected)selected-key else selected+key}.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(item["label"]!!.jsonPrimitive.content,fontWeight=FontWeight.SemiBold)
                        val recommended=key in recommendations&&available&&!core
                        Text(item["note"]!!.jsonPrimitive.content+(if(recommended)" · Recommended" else ""),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    when { core->Text("Core",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold);!available->Text("Coming Soon",color=MaterialTheme.colorScheme.onSurfaceVariant);else->Switch(checked=key in selected,enabled=!busy,onCheckedChange={checked->selected=if(checked)selected+key else selected-key}) }
                }
            }
        }
        item {
            Button(enabled=!busy,onClick = {
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
    Triple("General","/workspace/account/settings/general","⚙"),Triple("Transaction","/workspace/account/settings/transactions","▤"),Triple("Invoice Print","/workspace/account/settings/print-templates","⎙"),Triple("Taxes & GST","/workspace/account/tax/settings","%"),Triple("Employees","/workspace/employees","♥"),Triple("Transaction SMS","/workspace/account/settings/transaction-sms","✉"),Triple("Reminders","/workspace/account/settings/reminders","◷"),Triple("Party","/workspace/account/settings/party","☺"),Triple("Item","/workspace/account/inventory/item-settings","◇"),Triple("Multi-Currency","/workspace/account/settings/multi-currency","₹")
)

@Composable
fun AccountSettingsMenuScreen(padding:PaddingValues,navigate:(String)->Unit,back:()->Boolean){
    Column(Modifier.fillMaxSize().padding(padding)){
        Row(Modifier.fillMaxWidth().heightIn(min=56.dp).padding(horizontal=8.dp),verticalAlignment=Alignment.CenterVertically){IconButton(onClick={back()}){Text("←")};Text(accountLabel("Settings"),style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)}
        LazyColumn(Modifier.fillMaxSize()){items(accountSettingsDestinations){item->ListItem(headlineContent={Text(accountLabel(item.first))},leadingContent={Text(item.third,style=MaterialTheme.typography.titleLarge)},trailingContent={Text("›")},modifier=Modifier.fillMaxWidth().clickable{navigate(item.second)});HorizontalDivider()}}
    }
}

private data class PartyHelp(val title:String,val what:String,val why:String,val comingSoon:Boolean=false)
private val partyHelp=mapOf(
    "gstin" to PartyHelp("GSTIN Number","You can enter GSTIN/TIN/VATIN of a party while adding or editing the party. This number can be printed on invoices issued to that party.","Enable this when you want the party’s GSTIN/TIN/VATIN number to be stored and shown on supported invoices."),
    "grouping" to PartyHelp("Party Grouping","Group similar types of parties together and assign parties to those groups.","Useful when you want groups such as Customers, Vendors, region-wise customers, or other business-specific groups and want reports or filtering based on those groups."),
    "additional" to PartyHelp("Party Additional Fields","Add extra fields to save more information for parties.","Use this when you need to enter and track additional party-level information specific to your business."),
    "shipping" to PartyHelp("Party Shipping Address","Enables you to add a separate shipping address for the party.","Useful when a party’s billing address is different from the shipping address so deliveries go to the correct location."),
    "print" to PartyHelp("Print Shipping Address","Enables you to print the party’s shipping address on supported invoices and bills.","Useful when the billing and shipping addresses are different and the delivery document should clearly show the shipping destination."),
    "loyalty" to PartyHelp("Loyalty Points","Loyalty Points will allow customers to earn points on eligible purchases and use them for discounts on later purchases.","A loyalty program can encourage repeat purchases and reward returning customers.",true)
)
@Composable private fun PartyInfoDialog(help:PartyHelp?,close:()->Unit){if(help!=null)AlertDialog(onDismissRequest=close,title={Text(help.title,fontWeight=FontWeight.Bold)},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){if(help.comingSoon)Text("Coming Soon",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold);Text("What is this?",fontWeight=FontWeight.Bold);Text(help.what);Text("Why to use?",fontWeight=FontWeight.Bold);Text(help.why)}},confirmButton={Button(onClick=close,modifier=Modifier.fillMaxWidth()){Text("OK")}})}
@Composable private fun PartySettingRow(label:String,checked:Boolean,enabled:Boolean=true,help:PartyHelp,change:(Boolean)->Unit,open:(PartyHelp)->Unit){ListItem(headlineContent={Text(label)},supportingContent=if(!enabled){{Text("Coming Soon")}}else null,trailingContent={Row(verticalAlignment=Alignment.CenterVertically){IconButton(onClick={open(help)}){Text("ⓘ")};Switch(checked,onCheckedChange=if(enabled)change else null,enabled=enabled)}});HorizontalDivider()}
@Composable
private fun PartySettingsView(
    data: JsonElement,
    vm: AccountAdministrationViewModel,
    navigate: (String) -> Unit,
    busy:Boolean
) {
    val saved = data.jsonObject["settings"]
        ?.jsonObject
        ?.get("transactionDefaults")
        ?.jsonObject
        ?.get("partySettings")
        ?.jsonObject

    fun bool(key: String, default: Boolean) =
        saved?.get(key)?.jsonPrimitive?.booleanOrNull ?: default

    var gstin by remember(saved) { mutableStateOf(bool("gstinEnabled", true)) }
    var grouping by remember(saved) { mutableStateOf(bool("groupingEnabled", false)) }
    var shipping by remember(saved) { mutableStateOf(bool("shippingAddressEnabled", true)) }
    var printShipping by remember(saved) { mutableStateOf(bool("printShippingAddress", false)) }
    var help by remember { mutableStateOf<PartyHelp?>(null) }

    LazyColumn {
        item {
            PartySettingRow(
                "GSTIN Number",
                gstin,
                !busy,
                partyHelp.getValue("gstin"),
                { gstin = it },
                { help = it }
            )
        }
        item {
            PartySettingRow(
                "Party Grouping",
                grouping,
                !busy,
                partyHelp.getValue("grouping"),
                { grouping = it },
                { help = it }
            )
        }
        item {
            ListItem(
                headlineContent = { Text("Party Additional Fields") },
                modifier = Modifier.clickable {
                    navigate("/workspace/account/settings/party/additional-fields")
                },
                trailingContent = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { help = partyHelp.getValue("additional") }) {
                            Text("ⓘ")
                        }
                        Text("›")
                    }
                }
            )
        }
        item {
            PartySettingRow(
                "Party Shipping Address",
                shipping,
                !busy,
                partyHelp.getValue("shipping"),
                { shipping = it },
                { help = it }
            )
        }
        item {
            PartySettingRow(
                "Print Shipping Address",
                printShipping,
                shipping&&!busy,
                partyHelp.getValue("print"),
                { printShipping = it },
                { help = it }
            )
        }
        item {
            PartySettingRow(
                "Loyalty Points",
                false,
                false,
                partyHelp.getValue("loyalty"),
                {},
                { help = it }
            )
        }
        item {
            Button(
                enabled=!busy,
                onClick = {
                    vm.save(
                        "party-settings",
                        buildJsonObject {
                            put("gstinEnabled", gstin)
                            put("groupingEnabled", grouping)
                            put("shippingAddressEnabled", shipping)
                            put("printShippingAddress", printShipping)
                        }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp)
            ) {
                Text("Save Party Settings")
            }
        }
    }

    PartyInfoDialog(help) { help = null }
}
@Composable private fun PartyAdditionalFieldsView(data:JsonElement,vm:AccountAdministrationViewModel,busy:Boolean){val existing=data.jsonObject["fields"]?.jsonArray.orEmpty().filter{it.jsonObject["entityType"]?.jsonPrimitive?.content=="CUSTOMER"}.associateBy{it.jsonObject["fieldKey"]?.jsonPrimitive?.content.orEmpty()};val keys=listOf("party_additional_1","party_additional_2","party_additional_3","party_date");var enabled by remember(existing){mutableStateOf(keys.map{existing[it]?.jsonObject?.get("isActive")?.jsonPrimitive?.booleanOrNull?:false})};var labels by remember(existing){mutableStateOf(keys.mapIndexed{i,key->existing[key]?.jsonObject?.get("label")?.jsonPrimitive?.content?:if(key=="party_date")"Date Field" else "Additional Field ${i+1}"})};var printing by remember(existing){mutableStateOf(keys.map{key->existing[key]?.jsonObject?.get("validation")?.jsonObject?.get("showInPrint")?.jsonPrimitive?.booleanOrNull?:false})};LazyColumn(contentPadding=PaddingValues(bottom=90.dp)){items(keys.size){i->Text(if(i==3)"Date Field" else "Additional Field ${i+1}",fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=16.dp));SwitchRow("Enable",enabled[i],!busy){value->enabled=enabled.mapIndexed{index,old->if(index==i)value else old}};OutlinedTextField(labels[i],{value->labels=labels.mapIndexed{index,old->if(index==i)value else old}},label={Text("Field Name")},enabled=enabled[i]&&!busy,modifier=Modifier.fillMaxWidth());if(i==3)OutlinedTextField("dd/MM/yyyy",{},readOnly=true,label={Text("Date Format")},enabled=enabled[i]&&!busy,modifier=Modifier.fillMaxWidth());SwitchRow("Show in print",printing[i],enabled[i]&&!busy){value->printing=printing.mapIndexed{index,old->if(index==i)value else old}}};item{Button(enabled=!busy&&labels.all{it.isNotBlank()&&it.length<=100},onClick={vm.save("party-additional-fields",buildJsonArray{keys.forEachIndexed{i,key->add(buildJsonObject{put("key",key);put("enabled",enabled[i]);put("label",labels[i]);put("showInPrint",printing[i]);if(i==3)put("dateFormat","DD/MM/YYYY")})}})},modifier=Modifier.fillMaxWidth().padding(top=16.dp)){Text("Save")}}}}
@Composable private fun TransactionSmsView(data:JsonElement,vm:AccountAdministrationViewModel,busy:Boolean){
 val saved=data.jsonObject["settings"]?.jsonObject?.get("transactionDefaults")?.jsonObject?.get("transactionMessaging")?.jsonObject
 var party by remember(saved){mutableStateOf(saved?.get("sendToParty")?.jsonPrimitive?.booleanOrNull?:false)}
 var self by remember(saved){mutableStateOf(saved?.get("copyToSelf")?.jsonPrimitive?.booleanOrNull?:false)}
 var link by remember(saved){mutableStateOf(saved?.get("includeInvoiceLink")?.jsonPrimitive?.booleanOrNull?:false)}
 Column{Text("Prepare messages for manual sending. Use SMS, WhatsApp, copy or share.");SwitchRow("Send to party",party,!busy){party=it};SwitchRow("Prepare Copy to Self",self,!busy){self=it};SwitchRow("Include Invoice Link",link,!busy){link=it};Button(enabled=!busy,onClick={vm.save("transaction-messaging",buildJsonObject{put("sendToParty",party);put("copyToSelf",self);put("includeInvoiceLink",link)})}){Text("Save")}}
}
@Composable private fun BusinessCurrencyView(data:JsonElement,vm:AccountAdministrationViewModel,busy:Boolean){
 var currency by remember(data){mutableStateOf(data.jsonObject["settings"]?.jsonObject?.get("baseCurrency")?.jsonPrimitive?.content?:"INR")}
 Column{Text("Business Currency");listOf("INR","USD","EUR","GBP","AED").forEach{x->Row(verticalAlignment=Alignment.CenterVertically){RadioButton(currency==x,{currency=x},enabled=!busy);Text(x)}};Text("Currency can be changed before accounting entries are posted.");Button(enabled=!busy,onClick={vm.save("business-currency",buildJsonObject{put("baseCurrency",currency)})}){Text("Save")}}
}

@Composable
private fun GeneralSettingsView(data:JsonElement,vm:AccountAdministrationViewModel,navigate:(String)->Unit){
    val context=LocalContext.current
    val busy=vm.state.collectAsStateWithLifecycle().value.loading
    val current=data.jsonObject["settings"]?.jsonObject?:JsonObject(emptyMap())
    var assetsEnabled by remember(data){mutableStateOf(data.jsonObject["modules"]?.jsonArray?.any{it.jsonPrimitive.content=="ASSETS"}?:true)}
    var language by remember(current){mutableStateOf(current["appLanguage"]?.jsonPrimitive?.content?:"en")}
    var currency by remember(current){mutableStateOf(current["baseCurrency"]?.jsonPrimitive?.content?:"INR")}
    var decimals by remember(current){mutableStateOf(current["displayDecimalPlaces"]?.jsonPrimitive?.intOrNull?:2)}
    var dateFormat by remember(current){mutableStateOf(current["dateFormat"]?.jsonPrimitive?.content?:"DD/MM/YYYY")}
    var warning by remember(current){mutableStateOf(current["warnUnsavedChanges"]?.jsonPrimitive?.booleanOrNull?:true)}
    val appearance="STANDARD"
    val originalAssets=data.jsonObject["modules"]?.jsonArray?.any{it.jsonPrimitive.content=="ASSETS"}?:true
    val dirty=language!=(current["appLanguage"]?.jsonPrimitive?.content?:"en")||currency!=(current["baseCurrency"]?.jsonPrimitive?.content?:"INR")||decimals!=(current["displayDecimalPlaces"]?.jsonPrimitive?.intOrNull?:2)||dateFormat!=(current["dateFormat"]?.jsonPrimitive?.content?:"DD/MM/YYYY")||warning!=(current["warnUnsavedChanges"]?.jsonPrimitive?.booleanOrNull?:true)||assetsEnabled!=originalAssets
    var leaveTo by remember{mutableStateOf<String?>(null)}
    androidx.activity.compose.BackHandler(enabled=dirty&&warning){leaveTo="/workspace/account/settings"}
    fun open(path:String){if(dirty&&warning)leaveTo=path else navigate(path)}
    if(leaveTo!=null)AlertDialog(onDismissRequest={leaveTo=null},title={Text(accountLabel("Unsaved changes"))},text={Text(accountLabel("Leave General Settings without saving your changes?"))},confirmButton={TextButton({val path=leaveTo!!;leaveTo=null;navigate(path)}){Text(accountLabel("Leave"))}},dismissButton={TextButton({leaveTo=null}){Text(accountLabel("Stay"))}})
    LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)){
        item{Text(accountLabel("Application"),style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
        item{ChoiceSetting("App Language",language,listOf("en" to "English","hi" to "Hindi"),enabled=!busy){language=it}}
        item{ChoiceSetting("Business Currency",currency,listOf("INR","USD","EUR","GBP","AED").map{it to it},enabled=!busy){currency=it}}
        item{ListItem(headlineContent={Text(accountLabel("Decimal Places"))},supportingContent={Text(accountLabel("Display precision only; stored calculation precision is unchanged."))},trailingContent={Row(verticalAlignment=Alignment.CenterVertically){IconButton(onClick={decimals=(decimals-1).coerceAtLeast(0)},enabled=!busy&&decimals>0){Text(accountLabel("−"))};Text(decimals.toString());IconButton(onClick={decimals=(decimals+1).coerceAtMost(4)},enabled=!busy&&decimals<4){Text(accountLabel("+"))}}})}
        item{ChoiceSetting("Date Format",dateFormat,listOf("DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD").map{it to it},enabled=!busy){dateFormat=it}}
        item{SwitchRow(accountLabel("Show warning for unsaved changes"),warning,enabled=!busy){warning=it}}
        item{ListItem(headlineContent={Text(accountLabel("Theme"))},supportingContent={Text(accountLabel("Standard"))})}
        item{SwitchRow(accountLabel("Fixed Assets"),assetsEnabled,enabled=!busy){assetsEnabled=it}}
        item{Text(accountLabel("Business & Data"),style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
        item{ListItem(headlineContent={Text(accountLabel("Multi-Branch Settings"))},trailingContent={Text(accountLabel("›"))},modifier=Modifier.clickable{open("/workspace/account/settings/multi-branch")})}
        item{ListItem(headlineContent={Text(accountLabel("Godown / Warehouse & Stock Transfer"))},trailingContent={Text(accountLabel("›"))},modifier=Modifier.clickable{open("/workspace/account/inventory/warehouses")})}
        item{ListItem(headlineContent={Text(accountLabel("Backup Settings"))},trailingContent={Text(accountLabel("›"))},modifier=Modifier.clickable{open("/workspace/account/settings/backup")})}
        item{Text(accountLabel("Security"),style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);ListItem(headlineContent={Text(accountLabel("Passcode / Fingerprint"))},supportingContent={Text(accountLabel("Managed by Android device security"))},trailingContent={Text(accountLabel("›"))},modifier=Modifier.clickable{context.startActivity(android.content.Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS))})}
        item{Button(enabled=!busy,onClick={vm.save("general",buildJsonObject{put("appLanguage",language);put("baseCurrency",currency);put("displayDecimalPlaces",decimals);put("dateFormat",dateFormat);put("warnUnsavedChanges",warning);put("appearance",appearance);put("fixedAssetsEnabled",assetsEnabled)})},modifier=Modifier.fillMaxWidth()){Text(accountLabel("Save General Settings"))}}
    }
}

@Composable
private fun ChoiceSetting(label:String,value:String,choices:List<Pair<String,String>>,enabled:Boolean=true,change:(String)->Unit){var open by remember{mutableStateOf(false)};Box{OutlinedButton(enabled=enabled,onClick={open=true},modifier=Modifier.fillMaxWidth()){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(accountLabel(label));Text(accountLabel(choices.firstOrNull{it.first==value}?.second?:value))}};DropdownMenu(expanded=open,onDismissRequest={open=false}){choices.forEach{choice->DropdownMenuItem(text={Text(accountLabel(choice.second))},onClick={change(choice.first);open=false})}}}}

@Composable private fun TransactionDefaultsView(data:JsonElement,vm:AccountAdministrationViewModel,busy:Boolean){
 val saved=data.jsonObject["settings"]?.jsonObject?.get("transactionDefaults")?.jsonObject
 var days by remember(saved){mutableStateOf(saved?.get("defaultDueDays")?.jsonPrimitive?.content?:"0")};var sale by remember(saved){mutableStateOf(saved?.get("salesTerms")?.jsonPrimitive?.content?:"")};var purchase by remember(saved){mutableStateOf(saved?.get("purchaseTerms")?.jsonPrimitive?.content?:"")};var project by remember(saved){mutableStateOf(saved?.get("projectTerms")?.jsonPrimitive?.content?:"")}
 LazyColumn{item{OutlinedTextField(days,{days=it},label={Text("Default Due Days")})};item{OutlinedTextField(sale,{sale=it},label={Text("Sale Terms & Conditions")})};item{OutlinedTextField(purchase,{purchase=it},label={Text("Purchase Terms & Conditions")})};item{OutlinedTextField(project,{project=it},label={Text("Project Terms & Conditions")})};item{Button(enabled=!busy&&days.toIntOrNull() in 0..365&&listOf(sale,purchase,project).all{it.length<=5000},onClick={vm.save("transaction-defaults",buildJsonObject{put("defaultDueDays",days.toInt());put("salesTerms",sale);put("purchaseTerms",purchase);put("projectTerms",project)})}){Text("Save")}}}
}
@Composable private fun BackupSettingsView(data:JsonElement,vm:AccountAdministrationViewModel,navigate:(String)->Unit){
 val saved=data.jsonObject["settings"]?.jsonObject?.get("transactionDefaults")?.jsonObject?.get("backupSettings")?.jsonObject
 var auto by remember(saved){mutableStateOf(saved?.get("autoBackup")?.jsonPrimitive?.booleanOrNull?:false)};var interval by remember(saved){mutableStateOf(saved?.get("intervalDays")?.jsonPrimitive?.content?:"7")};var reminder by remember(saved){mutableStateOf(saved?.get("manualReminderDays")?.jsonPrimitive?.content?:"7")}
 Column{SwitchRow("Enable auto backup",auto){auto=it};OutlinedTextField(interval,{interval=it},label={Text("Automatic Backup Interval (days)")});OutlinedTextField(reminder,{reminder=it},label={Text("Manual Backup Reminder (days)")});Button(enabled=interval.toIntOrNull() in 1..365&&reminder.toIntOrNull() in 1..365,onClick={vm.save("backup-settings",buildJsonObject{put("autoBackup",auto);put("intervalDays",interval.toInt());put("manualReminderDays",reminder.toInt())})}){Text("Save")};TextButton({navigate("/workspace/account/utilities/backup")}){Text("Open Manual Backup")}}
}
@Composable private fun AttentionView(data:JsonElement,navigate:(String)->Unit,complete:(String)->Unit,busy:Boolean){
 val context=LocalContext.current;val rows=((data as? JsonArray)?:((data as? JsonObject)?.get("rows") as? JsonArray)).orEmpty();var error by remember{mutableStateOf<String?>(null)}
 LazyColumn{if(rows.isEmpty())item{Text("All caught up")};error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}};items(rows){row->val x=row.jsonObject;val kind=x["type"]?.jsonPrimitive?.content.orEmpty();val message=x["message"]?.jsonPrimitive?.content.orEmpty();val document=x["documentId"]?.jsonPrimitive?.content.orEmpty();val number=x["documentNumber"]?.jsonPrimitive?.content.orEmpty();val party=x["partyName"]?.jsonPrimitive?.content.orEmpty()
 Card(Modifier.fillMaxWidth().padding(vertical=8.dp)){Column(Modifier.padding(14.dp)){Text(if(kind=="SERVICE_REMINDER")"Service reminder — $party" else if(kind=="PAYMENT_REMINDER")"Payment reminder — $party" else x["title"]?.jsonPrimitive?.content?:x["transactionNumber"]?.jsonPrimitive?.content?:kind);if(message.isNotBlank()){Text(message);Button({try{context.startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND).apply{type="text/plain";putExtra(android.content.Intent.EXTRA_TEXT,message)},"Send reminder"))}catch(_:Exception){error="No app is available to share this message"}}){Text("Share message")}};TextButton({navigate(if(document.isNotBlank())"/workspace/account/sales/$document" else x["navigationTarget"]?.jsonPrimitive?.content?:"/workspace/account/expenses?status=PENDING_APPROVAL")}){Text(if(number.isNotBlank())"Open $number" else "Open")};if(kind=="SERVICE_REMINDER")Button(enabled=!busy,onClick={complete(x["lineId"]?.jsonPrimitive?.content.orEmpty())}){Text("Mark service completed")}}}
 }}
}
