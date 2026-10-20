package com.salespunch360.mobile.ui.account.sales

import com.salespunch360.mobile.account.wholesaleRate
import com.salespunch360.mobile.account.customerPrice
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.booleanOrNull

import com.salespunch360.mobile.ui.account.accountDate
import com.salespunch360.mobile.ui.account.accountMoney
import android.Manifest
import android.provider.ContactsContract
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import com.salespunch360.mobile.account.*
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Composable
fun SalesDocumentEditor(
    draft: SalesEditorDraft,
    options: SalesOptions,
    saving: Boolean,
    onDraft: (SalesEditorDraft) -> Unit,
    onAdd: () -> Unit,
    onLine: (Int, SalesLineDraft) -> Unit,
    onRemove: (Int) -> Unit,
    onClose: () -> Unit,
    onSave: (Boolean) -> Unit,
    onPrefix:(String)->Unit,
    onCreateCustomer:(JsonObject,(String)->Unit)->Unit,
    navigate:(String)->Unit
) {
    if (draft.type == "SALES_INVOICE") {
        DirectSaleInvoiceEditor(draft, options, saving, onDraft, onAdd, onLine, onRemove, onClose, onSave,onPrefix,onCreateCustomer,navigate)
        return
    }
    val sources = options.sourceDocuments.filter {
        it.str("type") == "SALES_INVOICE" && it.str("branchId") == draft.branchId && it.str("customerId") == draft.customerId
    }
    val sourceLines = sources.firstOrNull { it.str("id") == draft.sourceDocumentId }?.array("lines").orEmpty()
    AlertDialog(
        onDismissRequest = { if (!saving) onClose() },
        title = { Text("New ${draft.type.replace('_', ' ')}") },
        confirmButton = {
            Button(
                enabled = !saving && draft.lines.none{it.quotationUnitReviewRequired} && draft.branchId.isNotBlank() && draft.customerId.isNotBlank() && draft.lines.all {
                    (it.servicePeriodDays.isBlank()||it.servicePeriodDays.toIntOrNull() in 1..3650)&&runCatching { primaryUnitQuantity(it.quantity,it.unitSelection,it.secondaryUnitsPerBase).signum()>0 }.getOrDefault(false) && (it.sourceId.isNotBlank() || it.itemName.isNotBlank())
                },
                onClick = { onSave(false) }
            ) { Text(if (saving) "Saving…" else "Create draft") }
        },
        dismissButton = { TextButton(enabled = !saving, onClick = onClose) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item { if(draft.sourceQuotationRevisionId.isNotBlank())Text("Document type: ${draft.type.replace('_',' ')}") else SelectField("Document type", draft.type, options.types.map { it to it.replace('_', ' ') }) { onDraft(draft.copy(type = it)) } }
                item { if(draft.sourceQuotationRevisionId.isNotBlank())Text("Branch: ${options.branches.firstOrNull{it.id==draft.branchId}?.name.orEmpty()}") else SelectField("Branch", draft.branchId, options.branches.map { it.id to it.name }) { onDraft(draft.copy(branchId = it, customerId = "")) } }
                item { if(draft.sourceQuotationRevisionId.isNotBlank())Text("Customer: ${options.customers.firstOrNull{it.id==draft.customerId}?.name.orEmpty()}") else SelectField("Customer", draft.customerId, options.customers.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { onDraft(draft.copy(customerId = it)) } }
                if (draft.type == "CREDIT_NOTE") item { SelectField("Original invoice", draft.sourceDocumentId, sources.map { it.str("id") to it.str("documentNumber") }) { onDraft(draft.copy(sourceDocumentId = it)) } }
                item { OutlinedTextField(draft.issueDate, { onDraft(draft.copy(issueDate = it)) }, label = { Text("Issue date (YYYY-MM-DD)") }) }
                item { OutlinedTextField(draft.dueDate, { onDraft(draft.copy(dueDate = it)) }, label = { Text("Due date (optional)") }) }
                item { SelectField("Tax mode", draft.taxMode, listOf("EXCLUSIVE" to "Exclusive", "INCLUSIVE" to "Inclusive")) { onDraft(draft.copy(taxMode = it)) } }
                item { OutlinedTextField(draft.stateOfSupplyCode, { onDraft(draft.copy(stateOfSupplyCode = it)) }, label = { Text("State of supply code") }) }
                if(draft.quotationReference!=null)item { QuotationConversionReference(draft) }
            itemsIndexed(draft.lines) { index, line -> SalesLineEditor(index, line, draft, options, sourceLines, onLine, onRemove) }
                item { OutlinedButton(onClick = onAdd, modifier = Modifier.fillMaxWidth()) { Text("Add line") } }
                item { OutlinedTextField(draft.notes, { onDraft(draft.copy(notes = it)) }, label = { Text("Notes") }, minLines = 2) }
                item { Text("Displayed line values are previews. Tax, totals, numbering, stock, and posting are confirmed by the server.", style = MaterialTheme.typography.bodySmall) }
            }
        }
    )
}

/** Native full-screen Sales Invoice surface. It reuses the canonical sales ViewModel/API. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DirectSaleInvoiceEditor(
    draft:SalesEditorDraft,
    options:SalesOptions,
    saving:Boolean,
    onDraft:(SalesEditorDraft)->Unit,
    onAdd:()->Unit,
    onLine:(Int,SalesLineDraft)->Unit,
    onRemove:(Int)->Unit,
    onClose:()->Unit,
    onSave:(Boolean)->Unit,
    onPrefix:(String)->Unit,
    onCreateCustomer:(JsonObject,(String)->Unit)->Unit,
    navigate:(String)->Unit
){
    val context=LocalContext.current
    val cash=draft.receivedInFull
    var customerSheet by remember{mutableStateOf(false)}
    var customerQuery by remember{mutableStateOf("")}
    var addCustomer by remember{mutableStateOf(false)}
    var customerName by remember{mutableStateOf("")}
    var customerPhone by remember{mutableStateOf("")}
    var customerGstin by remember{mutableStateOf("")}
    var customerEmail by remember{mutableStateOf("")}
    var billingAddress by remember{mutableStateOf("")}
    var shippingAddress by remember{mutableStateOf("")}
    var customerState by remember{mutableStateOf("")}
    var gstType by remember{mutableStateOf("UNREGISTERED")}
    var openingBalance by remember{mutableStateOf("0")}
    var openingDate by remember{mutableStateOf(java.time.LocalDate.now().toString())}
    var openingDirection by remember{mutableStateOf("RECEIVE")}
    var creditExpanded by remember{mutableStateOf(false)}
    var creditMode by remember{mutableStateOf("CUSTOM")}
    var creditLimit by remember{mutableStateOf("")}
    var partyTab by remember{mutableStateOf("ADDRESS")}
    var partyHelp by remember{mutableStateOf<String?>(null)}
    var gstTypeOpen by remember{mutableStateOf(false)}
    var stateOpen by remember{mutableStateOf(false)}
    var saleSettings by remember{mutableStateOf(false)}
    var more by remember{mutableStateOf(false)}
    var invoiceDialog by remember{mutableStateOf(false)}
    var prefixDraft by remember{mutableStateOf("")}
    var addItemPage by remember{mutableStateOf(false)}
    var datePicker by remember{mutableStateOf(false)}

    var itemName by remember{mutableStateOf("")}
    var itemQty by remember{mutableStateOf("1")}
    var itemPriceKind by remember{mutableStateOf("RETAIL")}
    var freeQty by remember{mutableStateOf("0")}
    var itemBatchId by remember{mutableStateOf("")}
    var itemSerialId by remember{mutableStateOf("")}
    var freeSerialId by remember{mutableStateOf("")}
    var itemTrackingError by remember{mutableStateOf<String?>(null)}
    val entryProduct=options.products.firstOrNull{it.name.equals(itemName.trim(),true)}
    var barcode by remember{mutableStateOf("")}
    var barcodeCameraOpen by remember{mutableStateOf(false)}
    var itemUnitId by remember{mutableStateOf("")}
    var itemRate by remember{mutableStateOf("")}
    var itemTaxMode by remember{mutableStateOf("WITHOUT")}
    var itemDescription by remember{mutableStateOf("")}

    if(barcodeCameraOpen&&options.transactionPreference("barcodeScanning"))BarcodeCameraDialog(onClose={barcodeCameraOpen=false},onDetected={value->
        barcodeCameraOpen=false
        val product=options.products.firstOrNull{it.barcode==value.trim()}
        if(product==null){barcode=value;Toast.makeText(context,"No item matches this barcode.",Toast.LENGTH_SHORT).show()}else{itemName=product.name;itemUnitId=product.unitId;itemPriceKind="RETAIL";itemRate=com.salespunch360.mobile.account.itemMasterPrice(product,if(itemTaxMode=="WITH")"INCLUSIVE"else "EXCLUSIVE").rate;itemBatchId="";itemSerialId="";freeSerialId="";itemTrackingError=null;barcode=""}
    })

    val states=listOf(
        "01" to "Jammu & Kashmir","02" to "Himachal Pradesh","03" to "Punjab","04" to "Chandigarh",
        "05" to "Uttarakhand","06" to "Haryana","07" to "Delhi","08" to "Rajasthan","09" to "Uttar Pradesh",
        "10" to "Bihar","11" to "Sikkim","12" to "Arunachal Pradesh","13" to "Nagaland","14" to "Manipur",
        "15" to "Mizoram","16" to "Tripura","17" to "Meghalaya","18" to "Assam","19" to "West Bengal",
        "20" to "Jharkhand","21" to "Odisha","22" to "Chhattisgarh","23" to "Madhya Pradesh","24" to "Gujarat",
        "26" to "Dadra & Nagar Haveli & Daman & Diu","27" to "Maharashtra","29" to "Karnataka","30" to "Goa",
        "32" to "Kerala","33" to "Tamil Nadu","34" to "Puducherry","35" to "Andaman & Nicobar Islands",
        "36" to "Telangana","37" to "Andhra Pradesh","38" to "Ladakh"
    )

    val contactPicker=rememberLauncherForActivityResult(ActivityResultContracts.PickContact()){uri->
        if(uri!=null){
            var contactId:String?=null
            context.contentResolver.query(
                uri,
                arrayOf(ContactsContract.Contacts._ID,ContactsContract.Contacts.DISPLAY_NAME),
                null,null,null
            )?.use{cursor->
                if(cursor.moveToFirst()){
                    contactId=cursor.getString(0)
                    customerName=cursor.getString(1).orEmpty()
                }
            }
            contactId?.let{id->
                context.contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID+"=?",
                    arrayOf(id),null
                )?.use{cursor->if(cursor.moveToFirst())customerPhone=cursor.getString(0).orEmpty()}
            }
        }
    }
    val contactsPermission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){granted->
        if(granted)contactPicker.launch(null)
        else Toast.makeText(context,"Contacts permission denied. Enter the party manually.",Toast.LENGTH_SHORT).show()
    }

    fun clearParty(){
        customerName="";customerPhone="";customerGstin="";customerEmail="";billingAddress="";shippingAddress="";
        customerState="";gstType="UNREGISTERED";openingBalance="0";openingDate=java.time.LocalDate.now().toString();
        openingDirection="RECEIVE";creditExpanded=false;creditMode="CUSTOM";creditLimit="";partyTab="ADDRESS"
    }
    fun saveParty(stay:Boolean){
        if(customerName.isBlank())return
        val payload=buildJsonObject{
            put("name",customerName.trim())
            customerPhone.trim().takeIf{it.isNotBlank()}?.let{put("phone",it)}
            customerEmail.trim().takeIf{it.isNotBlank()}?.let{put("email",it)}
            customerGstin.trim().takeIf{it.isNotBlank()}?.let{put("gstin",it)}
            billingAddress.trim().takeIf{it.isNotBlank()}?.let{put("address",it)}
            shippingAddress.trim().takeIf{it.isNotBlank()}?.let{put("shippingAddress",it)}
            customerState.takeIf{it.isNotBlank()}?.let{put("stateCode",it)}
            put("gstRegistrationType",gstType)
        }
        onCreateCustomer(payload){id->
            onDraft(draft.copy(customerId=id))
            if(stay)clearParty() else {addCustomer=false;customerSheet=false}
        }
    }
    fun entryPrice(master:com.salespunch360.mobile.account.SalesOption?,unitId:String=itemUnitId,kind:String=itemPriceKind)=com.salespunch360.mobile.account.itemMasterPriceForUnit(master,if(itemTaxMode=="WITH")"INCLUSIVE"else "EXCLUSIVE",discounts=options.itemWiseDiscount,quantity=itemQty.ifBlank{"1"},priceKind=kind,customerRate=master?.let{options.customerPrice(it.id,draft.customerId,draft.issueDate)},wholesaleRate=master?.let{options.wholesaleRate(it.id,draft.issueDate)},selection=if(unitId.isNotBlank()&&unitId==master?.secondaryUnitId)"SECONDARY"else "PRIMARY")
    fun commitItem(stay:Boolean){
        val name=itemName.trim()
        if(name.isBlank())return
        val product=options.products.firstOrNull{it.name.equals(name,true)}
        val service=if(product==null)options.services.firstOrNull{it.name.equals(name,true)} else null
        val master=product?:service
        val unit=options.units.firstOrNull{it.id==itemUnitId.ifBlank{master?.unitId.orEmpty()}}
        val defaultPrice=try{entryPrice(master)}catch(e:IllegalArgumentException){itemTrackingError=e.message;return}
        val line=SalesLineDraft(
            unitSelection=if(itemUnitId.isNotBlank()&&itemUnitId==master?.secondaryUnitId)"SECONDARY"else "PRIMARY",
            secondaryUnitsPerBase=master?.secondaryUnitsPerBase.orEmpty(),
            lineType=if(product!=null)"PRODUCT" else if(service!=null)"SERVICE" else "CUSTOM",
            sourceId=product?.id?:service?.id.orEmpty(),
            itemName=name,
            description=itemDescription,
            unitName=unit?.name.orEmpty(),
            unitSymbol=unit?.symbol.orEmpty(),
            quantity=itemQty.ifBlank{"1"},
            rate=itemRate.ifBlank{defaultPrice.rate},
            discountType=defaultPrice.discountType,discountValue=defaultPrice.discountValue,
            taxRate=product?.taxRate?:service?.taxRate?:"0",
            batchId=itemBatchId,serialNumberId=itemSerialId,
            warehouseId=if(product?.trackInventory==true)options.warehouses.filter{it.branchId==draft.branchId}.sortedByDescending{it.isDefault}.firstOrNull()?.id.orEmpty() else "",
        )
        val entered=try{com.salespunch360.mobile.account.saleLinesWithFreeItem(line,if(options.transactionPreference("freeItemQuantity"))freeQty else "0",product?.trackingMode?:"NONE",freeSerialId)}catch(e:IllegalArgumentException){itemTrackingError=e.message;return}
        onDraft(draft.copy(taxMode=if(itemTaxMode=="WITH")"INCLUSIVE" else "EXCLUSIVE",lines=draft.lines.filter{it.sourceId.isNotBlank()||it.itemName.isNotBlank()}+entered))
        itemBatchId="";itemSerialId="";freeSerialId="";itemTrackingError=null
        itemName="";itemPriceKind="RETAIL";itemQty="1";freeQty="0";itemUnitId="";itemRate="";itemTaxMode="WITHOUT";itemDescription=""
        if(!stay)addItemPage=false
    }

    if(addItemPage){
        Scaffold(
            topBar={
                TopAppBar(
                    title={Text("Add Items to Sale")},
                    navigationIcon={IconButton(onClick={addItemPage=false}){Text("←")}},
                    actions={IconButton(onClick={{navigate("/workspace/account/settings")}}){Icon(Icons.Default.Settings,"Settings")}}
                )
            },
            bottomBar={
                Row(Modifier.fillMaxWidth().navigationBarsPadding()){
                    TextButton(onClick={commitItem(true)},enabled=itemName.isNotBlank(),modifier=Modifier.weight(1f).height(64.dp)){Text("Save & New")}
                    Button(onClick={commitItem(false)},enabled=itemName.isNotBlank(),modifier=Modifier.weight(1f).height(64.dp),shape=MaterialTheme.shapes.extraSmall){Text("Save")}
                }
            }
        ){padding->
            LazyColumn(
                Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement=Arrangement.spacedBy(16.dp)
            ){
                if(options.transactionPreference("barcodeScanning"))item{Column{OutlinedTextField(barcode,{barcode=it},label={Text("Scan item barcode")},modifier=Modifier.fillMaxWidth());TextButton({val product=options.products.firstOrNull{it.barcode==barcode.trim()};if(product==null)Toast.makeText(context,"No item matches this barcode.",Toast.LENGTH_SHORT).show() else {itemName=product.name;itemUnitId=product.unitId;itemPriceKind="RETAIL";itemRate=com.salespunch360.mobile.account.itemMasterPrice(product,if(itemTaxMode=="WITH")"INCLUSIVE"else "EXCLUSIVE").rate;itemBatchId="";itemSerialId="";freeSerialId="";itemTrackingError=null;barcode=""}}){Text("Find item")};TextButton({barcodeCameraOpen=true}){Text("Scan with Camera")}}}
                itemTrackingError?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}}
                if(entryProduct?.trackingMode=="BATCH")item{SelectField("Batch",itemBatchId,options.batches.filter{it.str("productId")==entryProduct.id}.map{it.str("id") to it.str("batchNumber")}){itemBatchId=it}}
                if(entryProduct?.trackingMode=="SERIAL"){
                    item{SelectField("Serial Number",itemSerialId,options.serials.filter{it.str("productId")==entryProduct.id}.map{it.str("id") to it.str("serialNumber")}){itemSerialId=it}}
                    if(options.transactionPreference("freeItemQuantity")&&(freeQty.toDoubleOrNull()?:0.0)>0)item{SelectField("Free Item Serial Number",freeSerialId,options.serials.filter{it.str("productId")==entryProduct.id&&it.str("id")!=itemSerialId}.map{it.str("id") to it.str("serialNumber")}){freeSerialId=it}}
                }
                if(options.transactionPreference("freeItemQuantity"))item{OutlinedTextField(freeQty,{freeQty=it},label={Text("Free Item quantity")},modifier=Modifier.fillMaxWidth())}
                item{
                    OutlinedTextField(
                        itemName,
                        {itemName=it;itemUnitId="";itemPriceKind="RETAIL";itemRate="";itemBatchId="";itemSerialId="";freeSerialId="";itemTrackingError=null},
                        label={Text("Item Name")},
                        placeholder={Text("e.g. Chocolate Cake")},
                        modifier=Modifier.fillMaxWidth()
                    )
                }
                val unitMaster=entryProduct?:options.services.firstOrNull{it.name.equals(itemName.trim(),true)}
                item{
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedTextField(itemQty,{itemQty=it},label={Text("Quantity")},modifier=Modifier.weight(1f))
                        SelectField("Unit",itemUnitId.ifBlank{unitMaster?.unitId.orEmpty()},options.units.filter{unitMaster?.unitId.isNullOrBlank()||it.id==unitMaster?.unitId||it.id==unitMaster?.secondaryUnitId}.map{it.id to "${it.name} (${it.symbol.orEmpty()})"},Modifier.weight(1f)){id->try{itemRate=entryPrice(unitMaster,id).rate;itemUnitId=id;itemTrackingError=null}catch(e:IllegalArgumentException){itemTrackingError=e.message}}
                    }
                }
                val priceMaster=entryProduct?:options.services.firstOrNull{it.name.equals(itemName.trim(),true)}
                val customerRate=entryProduct?.let{options.customerPrice(it.id,draft.customerId,draft.issueDate)}
                val wholesaleRate=entryProduct?.let{options.wholesaleRate(it.id,draft.issueDate)}
                val hasWholesale=options.wholesalePrice&&(wholesaleRate!=null||priceMaster?.pricing?.str("normalizedWholesalePrice")?.toBigDecimalOrNull()!=null)
                if(hasWholesale||customerRate!=null)item{SelectField("Price type",itemPriceKind,listOf("RETAIL" to "Retail")+(if(hasWholesale)listOf("WHOLESALE" to "Wholesale")else emptyList())+(if(customerRate!=null)listOf("CUSTOMER" to "Customer Price")else emptyList())){kind->try{itemRate=entryPrice(priceMaster,kind=kind).rate;itemPriceKind=kind;itemTrackingError=null}catch(e:IllegalArgumentException){itemTrackingError=e.message}}}
                item{
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedTextField(itemRate,{itemRate=it},label={Text("Rate (Price/Unit)")},modifier=Modifier.weight(1f))
                        if(options.transactionPreference("rateTaxMode",true))SelectField("Tax",itemTaxMode,listOf("WITHOUT" to "Without Tax","WITH" to "With Tax"),Modifier.weight(1f)){itemTaxMode=it}
                    }
                }
                val selectedItem=(options.products+options.services).firstOrNull{it.name.equals(itemName,true)}
                if(options.transactionPreference("displayPurchasePrice")&&selectedItem!=null)item{Text("Purchase Price: ${selectedItem.costPrice?.let{accountMoney(it)}?:"Not recorded"}")}
                if(options.transactionPreference("lastFiveSalePrices")&&selectedItem!=null)item{Column{Text("Last 5 Sale Prices",fontWeight=FontWeight.Bold);val prices=options.recentSalePrices.filter{it.str("sourceId")==selectedItem.id};if(prices.isEmpty())Text("No previous sales for this item.");prices.forEach{price->Text("${price.str("documentNumber")} · ${accountDate(price.str("issueDate"))} · ${accountMoney(price.str("rate"))}")}}}
                item{OutlinedTextField(itemDescription,{itemDescription=it},label={Text("Description")},minLines=4,modifier=Modifier.fillMaxWidth())}
            }
        }
        return
    }

    if(addCustomer){
        Scaffold(
            topBar={
                TopAppBar(
                    title={Text("Add New Party")},
                    navigationIcon={IconButton(onClick={addCustomer=false}){Text("←")}},
                    actions={IconButton(onClick={navigate("/workspace/account/settings/party")}){Icon(Icons.Default.Settings,"Party settings")}}
                )
            },
            bottomBar={
                Row(Modifier.fillMaxWidth().navigationBarsPadding()){
                    TextButton(onClick={saveParty(true)},enabled=customerName.isNotBlank()&&!saving,modifier=Modifier.weight(1f).height(64.dp)){Text("Save & New")}
                    Button(onClick={saveParty(false)},enabled=customerName.isNotBlank()&&!saving,modifier=Modifier.weight(1f).height(64.dp),shape=MaterialTheme.shapes.extraSmall){Text("Save Party")}
                }
            }
        ){padding->
            LazyColumn(
                Modifier.fillMaxSize().padding(padding),
                contentPadding=PaddingValues(16.dp,18.dp,16.dp,90.dp),
                verticalArrangement=Arrangement.spacedBy(14.dp)
            ){
                item{
                    ElevatedCard(colors=CardDefaults.elevatedCardColors(containerColor=MaterialTheme.colorScheme.errorContainer)){
                        ListItem(
                            headlineContent={Text("Invite Parties",fontWeight=FontWeight.Bold)},
                            supportingContent={Text("to fill their details")},
                            trailingContent={Text("›")},
                            colors=ListItemDefaults.colors(containerColor=MaterialTheme.colorScheme.errorContainer)
                        )
                    }
                }
                item{OutlinedTextField(customerName,{customerName=it},label={Text("Party Name *")},placeholder={Text("e.g. Ram Prasad")},modifier=Modifier.fillMaxWidth())}
                item{TextButton(onClick={contactsPermission.launch(Manifest.permission.READ_CONTACTS)}){Text("Add party through contacts")}}
                item{OutlinedTextField(customerGstin,{customerGstin=it.uppercase()},label={Text("GSTIN")},modifier=Modifier.fillMaxWidth())}
                if(customerName.isNotBlank()){
                    item{OutlinedTextField(customerPhone,{customerPhone=it},label={Text("Contact Number")},modifier=Modifier.fillMaxWidth())}
                    item{
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                            OutlinedTextField(
                                openingBalance,{openingBalance=it},label={Text("Opening Bal.")},
                                modifier=Modifier.weight(1f),
                                trailingIcon={IconButton(onClick={partyHelp="OPENING"}){Text("ⓘ")}}
                            )
                            OutlinedTextField(openingDate,{openingDate=it},label={Text("As of Date")},modifier=Modifier.weight(1f))
                        }
                    }
                    item{
                        Row(horizontalArrangement=Arrangement.spacedBy(24.dp)){
                            Row(verticalAlignment=Alignment.CenterVertically){RadioButton(openingDirection=="RECEIVE",{openingDirection="RECEIVE"});Text("To Receive")}
                            Row(verticalAlignment=Alignment.CenterVertically){RadioButton(openingDirection=="PAY",{openingDirection="PAY"});Text("To Pay")}
                        }
                    }
                    if(!creditExpanded){
                        item{TextButton(onClick={creditExpanded=true},modifier=Modifier.fillMaxWidth()){Text("Set Credit Limit　ⓘ")}}
                    }else{
                        item{
                            OutlinedTextField(
                                creditLimit,{creditLimit=it},enabled=creditMode=="CUSTOM",
                                label={Text("Credit Limit")},modifier=Modifier.fillMaxWidth(),
                                trailingIcon={IconButton(onClick={partyHelp="CREDIT"}){Text("ⓘ")}}
                            )
                        }
                        item{
                            Row(horizontalArrangement=Arrangement.spacedBy(24.dp)){
                                Row(verticalAlignment=Alignment.CenterVertically){RadioButton(creditMode=="CUSTOM",{creditMode="CUSTOM"});Text("Custom Limit")}
                                Row(verticalAlignment=Alignment.CenterVertically){RadioButton(creditMode=="NONE",{creditMode="NONE"});Text("No Limit")}
                            }
                        }
                    }
                    item{
                        Row(Modifier.fillMaxWidth()){
                            TextButton(onClick={partyTab="ADDRESS"},modifier=Modifier.weight(1f)){Text("Addresses",fontWeight=if(partyTab=="ADDRESS")FontWeight.Bold else FontWeight.Normal)}
                            TextButton(onClick={partyTab="GST"},modifier=Modifier.weight(1f)){Text("GST Details",fontWeight=if(partyTab=="GST")FontWeight.Bold else FontWeight.Normal)}
                        }
                    }
                    if(partyTab=="ADDRESS"){
                        item{OutlinedTextField(billingAddress,{billingAddress=it},label={Text("Billing Address")},modifier=Modifier.fillMaxWidth(),minLines=2)}
                        item{OutlinedTextField(shippingAddress,{shippingAddress=it},label={Text("Shipping Address")},modifier=Modifier.fillMaxWidth(),minLines=2)}
                        item{OutlinedTextField(customerEmail,{customerEmail=it},label={Text("Email Address")},modifier=Modifier.fillMaxWidth())}
                    }else{
                        item{
                            OutlinedButton(onClick={gstTypeOpen=true},modifier=Modifier.fillMaxWidth()){
                                Column(Modifier.fillMaxWidth(),horizontalAlignment=Alignment.Start){
                                    Text("GST Type",style=MaterialTheme.typography.labelSmall)
                                    Text(when(gstType){"REGULAR"->"Registered - Regular";"COMPOSITION"->"Registered - Composite";"SEZ"->"SEZ";else->"Unregistered/Consumer"})
                                }
                            }
                        }
                        item{
                            OutlinedButton(onClick={stateOpen=true},modifier=Modifier.fillMaxWidth()){
                                Column(Modifier.fillMaxWidth(),horizontalAlignment=Alignment.Start){
                                    Text("State",style=MaterialTheme.typography.labelSmall)
                                    Text(states.firstOrNull{it.first==customerState}?.second?:"Select State")
                                }
                            }
                        }
                    }
                }
            }
        }
        if(gstTypeOpen)ModalBottomSheet(onDismissRequest={gstTypeOpen=false}){
            Column(Modifier.fillMaxWidth()){
                Row(Modifier.fillMaxWidth().padding(20.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                    Text("GST Type",style=MaterialTheme.typography.titleLarge)
                    IconButton(onClick={gstTypeOpen=false}){Text("×")}
                }
                listOf(
                    "UNREGISTERED" to "Unregistered/Consumer",
                    "REGULAR" to "Registered - Regular",
                    "COMPOSITION" to "Registered - Composite",
                    "SEZ" to "SEZ"
                ).forEach{(value,label)->
                    ListItem(headlineContent={Text(label)},modifier=Modifier.clickable{gstType=value;gstTypeOpen=false})
                    HorizontalDivider()
                }
                Spacer(Modifier.navigationBarsPadding())
            }
        }
        if(stateOpen)ModalBottomSheet(onDismissRequest={stateOpen=false}){
            Column(Modifier.fillMaxWidth().heightIn(max=700.dp)){
                Row(Modifier.fillMaxWidth().padding(20.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                    Text("State",style=MaterialTheme.typography.titleLarge)
                    IconButton(onClick={stateOpen=false}){Text("×")}
                }
                LazyColumn{
                    item{ListItem(headlineContent={Text("Select State")},modifier=Modifier.clickable{customerState="";stateOpen=false});HorizontalDivider()}
                    items(states){(code,label)->
                        ListItem(headlineContent={Text(label)},modifier=Modifier.clickable{customerState=code;stateOpen=false})
                        HorizontalDivider()
                    }
                }
                Spacer(Modifier.navigationBarsPadding())
            }
        }
        if(partyHelp=="OPENING"){
            AlertDialog(
                onDismissRequest={partyHelp=null},
                text={Text("The amount to give/receive from the party before adding them to SalesPunch360.")},
                confirmButton={TextButton(onClick={partyHelp=null}){Text("OK")}}
            )
        }
        if(partyHelp=="CREDIT"){
            AlertDialog(
                onDismissRequest={partyHelp=null},
                title={Text("Credit Limit")},
                text={Text("Set the maximum amount you want to give this party as credit. SalesPunch360 can use this limit to warn when the receivable balance crosses the amount you have set.")},
                confirmButton={Button(onClick={partyHelp=null}){Text("OK, Got It!")}}
            )
        }
        return
    }

    Scaffold(
        topBar={
            TopAppBar(
                title={Text("Sale",fontWeight=FontWeight.Bold)},
                navigationIcon={IconButton(onClick=onClose){Text("←")}},
                actions={
                    SingleChoiceSegmentedButtonRow{
                        listOf("Credit","Cash").forEachIndexed{i,label->
                            SegmentedButton(
                                selected=cash==(i==1),
                                onClick={onDraft(draft.copy(receivedInFull=i==1))},
                                shape=SegmentedButtonDefaults.itemShape(i,2)
                            ){Text(label)}
                        }
                    }
                    IconButton(onClick={saleSettings=true}){Icon(Icons.Default.Settings,"Sale settings")}
                }
            )
        },
        bottomBar={
            Surface(shadowElevation=8.dp){
                Row(
                    Modifier.fillMaxWidth().navigationBarsPadding().padding(10.dp),
                    horizontalArrangement=Arrangement.spacedBy(8.dp)
                ){
                    OutlinedButton(onClick={onSave(true)},enabled=!saving&&draft.lines.none{it.quotationUnitReviewRequired}&&invoiceCustomFieldsValid(options.invoiceCustomFields,draft.type,draft.customFields)&&draft.lines.all{it.servicePeriodDays.isBlank()||it.servicePeriodDays.toIntOrNull() in 1..3650},modifier=Modifier.weight(1f)){Text("Save & New")}
                    Button(onClick={onSave(false)},enabled=!saving&&draft.lines.none{it.quotationUnitReviewRequired}&&invoiceCustomFieldsValid(options.invoiceCustomFields,draft.type,draft.customFields)&&draft.lines.all{it.servicePeriodDays.isBlank()||it.servicePeriodDays.toIntOrNull() in 1..3650},modifier=Modifier.weight(1f)){Text(if(saving)"Saving…" else "Save")}
                    IconButton(onClick={more=true}){Text("⋮")}
                }
            }
        }
    ){padding->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)
        ){
            item{
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                    if(options.transactionPreference("showInvoiceNumber",true))Column(Modifier.clickable{invoiceDialog=true}){
                        Text("Invoice No.",style=MaterialTheme.typography.labelSmall)
                        val series=options.numberingSeries.firstOrNull{it.branchId==draft.branchId}
                        Text(
                            series?.let{"${it.prefix}${it.nextSequence.toString().padStart(maxOf(2,it.padding),'0')}${it.suffix}⌄"}?:"01⌄",
                            fontWeight=FontWeight.Bold
                        )
                    }
                    Column(Modifier.clickable{datePicker=true},horizontalAlignment=Alignment.End){
                        Text("Date",style=MaterialTheme.typography.labelSmall)
                        Text("${draft.issueDate}⌄",fontWeight=FontWeight.Bold)
                    }
                }
            }
            item{
                if(options.projects.isNotEmpty()){
                    SelectField(
                        if(draft.projectRequired) "Project *" else "Project (optional for regular sale)",
                        draft.projectId,
                        options.projects.filter{draft.projectRequired||it.branchId==draft.branchId}.map{it.id to it.name}
                    ){id->selectProjectForInvoice(draft,options,id)?.let(onDraft)}
                }
            }
            item{
                OutlinedButton(enabled=!saving&&!draft.projectRequired&&draft.sourceQuotationRevisionId.isBlank(),onClick={customerSheet=true},modifier=Modifier.fillMaxWidth()){
                    Text(options.customers.firstOrNull{it.id==draft.customerId}?.name?:"Search or select customer")
                }
            }
            if(options.transactionPreference("billingName",true))item{OutlinedTextField(draft.billingName,{if(it.length<=240)onDraft(draft.copy(billingName=it))},enabled=!saving,label={Text("Billing Name (Optional)")},modifier=Modifier.fillMaxWidth())}
            if(options.transactionPreference("customerPoDetails")){
                item{OutlinedTextField(draft.customerPoNumber,{if(it.length<=100)onDraft(draft.copy(customerPoNumber=it))},enabled=!saving,label={Text("Customer PO Number")},modifier=Modifier.fillMaxWidth())}
                item{OutlinedTextField(draft.customerPoDate,{onDraft(draft.copy(customerPoDate=it))},enabled=!saving,label={Text("Customer PO Date (YYYY-MM-DD)")},modifier=Modifier.fillMaxWidth())}
            }
            if(options.transactionPreference("transactionTime"))item{OutlinedTextField(draft.transactionTime,{onDraft(draft.copy(transactionTime=it))},enabled=!saving,label={Text("Transaction Time (HH:mm)")},modifier=Modifier.fillMaxWidth())}
            if(options.transactionPreference("ewayBillNumber"))item{OutlinedTextField(draft.ewayBillNumber,{if(it.length<=12&&it.all(Char::isDigit))onDraft(draft.copy(ewayBillNumber=it))},enabled=!saving,label={Text("E-Way Bill No.")},modifier=Modifier.fillMaxWidth())}
            item{InvoiceCustomFields(options.invoiceCustomFields,draft.type,draft.customFields,saving){onDraft(draft.copy(customFields=it))}}
            if(options.shippingAddressEnabled)item{OutlinedTextField(draft.shippingAddress,{if(it.length<=5000)onDraft(draft.copy(shippingAddress=it))},enabled=!saving,label={Text("Shipping Address")},minLines=2,modifier=Modifier.fillMaxWidth())}
            if(options.transactionPreference("termsEnabled",true))item{OutlinedTextField(draft.notes,{if(it.length<=5000)onDraft(draft.copy(notes=it))},enabled=!saving,label={Text("Terms & Conditions")},minLines=2,modifier=Modifier.fillMaxWidth())}
            item{OutlinedTextField(draft.dueDate,{onDraft(draft.copy(dueDate=it))},enabled=!saving,label={Text("Due date (YYYY-MM-DD)")},modifier=Modifier.fillMaxWidth())}
            if(options.transactionPreference("itemCount"))item{Text("Total Qty: ${draft.lines.sumOf{it.quantity.toDoubleOrNull()?:0.0}}")}
            item{OutlinedButton(onClick={addItemPage=true},modifier=Modifier.fillMaxWidth()){Text("+ Add Items (Optional)")}}
            if(draft.quotationReference!=null)item { QuotationConversionReference(draft) }
            itemsIndexed(draft.lines){index,line->
                if(line.sourceId.isNotBlank()||line.itemName.isNotBlank())SalesLineEditor(index,line,draft,options,emptyList(),onLine,onRemove)
            }
            if(options.transactionPreference("showProfit"))item{val profit=salesPreviewProfit(draft,options);Text(if(profit==null)"Enter purchase costs for these items to calculate profit." else "Estimated profit: ${accountMoney(profit.toPlainString())}")}
            val advance=com.salespunch360.mobile.account.salesPreviewAdvance(draft,options)
            if(advance.signum()>0)item{Text("Advance applied: ${accountMoney(advance.toPlainString())}")}
            if(cash)item{Text("New payment: ${accountMoney((salesPreviewTotal(draft,options)-advance).max(java.math.BigDecimal.ZERO).toPlainString())}",color=MaterialTheme.colorScheme.primary)}
            if(options.transactionPreference("transactionTax",true))item{OutlinedTextField(draft.transactionTaxRate,{onDraft(draft.copy(transactionTaxRate=it))},enabled=!saving,label={Text("Transaction Tax (%)")},placeholder={Text("Use item tax rates")},modifier=Modifier.fillMaxWidth())}
            if(options.transactionPreference("transactionDiscount",true))item{OutlinedTextField(draft.transactionDiscount,{onDraft(draft.copy(transactionDiscount=it))},enabled=!saving,label={Text("Transaction Discount (%)")},placeholder={Text("Use item discounts")},modifier=Modifier.fillMaxWidth())}
            if(options.transactionPreference("reverseCharge",true))item{Row(verticalAlignment=Alignment.CenterVertically){Checkbox(draft.reverseCharge,{onDraft(draft.copy(reverseCharge=it))},enabled=!saving);Text("Reverse Charge")}}
            if(options.transactionPreference("stateOfSupply",true))item{SelectField("State of Supply",draft.stateOfSupplyCode,states){onDraft(draft.copy(stateOfSupplyCode=it))}}
            if(!cash&&draft.editingSourceId.isBlank()){
                item{Row(verticalAlignment=Alignment.CenterVertically){Checkbox(draft.receivedEnabled,{onDraft(draft.copy(receivedEnabled=it))},enabled=!saving);Text("Received")}}
                if(draft.receivedEnabled)item{OutlinedTextField(draft.receivedAmount,{onDraft(draft.copy(receivedAmount=it))},enabled=!saving,label={Text("Received Amount")},modifier=Modifier.fillMaxWidth())}
            }
            item{SelectField("Payment Type",draft.paymentType,listOf("CASH" to "Cash","BANK" to "Bank","CHEQUE" to "Cheque")){if(!saving)onDraft(draft.copy(paymentType=it))}}
            if(draft.paymentType=="CHEQUE"&&draft.editingSourceId.isBlank()){
                item{OutlinedTextField(draft.chequeNumber,{onDraft(draft.copy(chequeNumber=it.take(80)))},enabled=!saving,label={Text("Cheque number")},modifier=Modifier.fillMaxWidth())}
                item{OutlinedTextField(draft.chequeDate,{onDraft(draft.copy(chequeDate=it))},enabled=!saving,label={Text("Cheque date (YYYY-MM-DD)")},modifier=Modifier.fillMaxWidth())}
                item{OutlinedTextField(draft.paymentReference,{onDraft(draft.copy(paymentReference=it.take(160)))},enabled=!saving,label={Text("Payment reference")},modifier=Modifier.fillMaxWidth())}
                item{Text("The invoice stays unpaid until this cheque is closed.")}
            }
            item{
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                    Text("Total Amount",fontWeight=FontWeight.Bold)
                    Text(accountMoney(salesPreviewTotal(draft,options).toPlainString()),fontWeight=FontWeight.Bold)
                }
            }
        }
    }

    if(saleSettings)ModalBottomSheet(onDismissRequest={saleSettings=false}){
        Column(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=12.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                Text("Settings",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
                IconButton(onClick={saleSettings=false}){Text("×")}
            }
            ListItem(headlineContent={Text("Sale Prefix")},supportingContent={Text("Uses the canonical Sales Invoice numbering series.")},modifier=Modifier.clickable{saleSettings=false;invoiceDialog=true})
            ListItem(headlineContent={Text("Transaction SMS")},trailingContent={Text("›")},modifier=Modifier.clickable{saleSettings=false;navigate("/workspace/account/settings/transaction-sms")})
            ListItem(headlineContent={Text("Additional Fields")},trailingContent={Text("›")},modifier=Modifier.clickable{saleSettings=false;navigate("/workspace/account/settings/custom-fields")})
            ListItem(headlineContent={Text("Additional Charges")},trailingContent={Text("›")},modifier=Modifier.clickable{saleSettings=false;navigate("/workspace/account/settings/transactions")})
            Text("Billing Type",fontWeight=FontWeight.Bold)
            ListItem(headlineContent={Text("Full Sale")},leadingContent={RadioButton(true,null)})
            ListItem(headlineContent={Text("Mobile POS")},supportingContent={Text("Coming Soon")},leadingContent={RadioButton(false,null)},colors=ListItemDefaults.colors(headlineColor=MaterialTheme.colorScheme.onSurfaceVariant))
            TextButton(onClick={saleSettings=false;navigate("/workspace/account/settings/transactions")},modifier=Modifier.fillMaxWidth()){Text("⚙ More Settings")}
            Spacer(Modifier.navigationBarsPadding())
        }
    }

    if(customerSheet)ModalBottomSheet(onDismissRequest={customerSheet=false}){
        Column(Modifier.fillMaxWidth().padding(16.dp)){
            Text("Select Customer",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
            OutlinedTextField(customerQuery,{customerQuery=it},label={Text("Search parties")},modifier=Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                Text("Showing Saved Parties",fontWeight=FontWeight.Bold)
                TextButton(onClick={clearParty();addCustomer=true}){Text("Add new party")}
            }
            options.customers.filter{it.name.contains(customerQuery,true)}.forEach{party->
                ListItem(
                    headlineContent={Text(party.name)},
                    supportingContent=party.phone?.let{phone->{Text(phone)}},
                    trailingContent={Text("›")},
                    modifier=Modifier.clickable{
                        onDraft(draft.copy(customerId=party.id,shippingAddress=if(options.shippingAddressEnabled)party.shippingAddress else draft.shippingAddress,stateOfSupplyCode=party.stateCode?:options.defaultStateCode))
                        customerSheet=false
                    }
                )
            }
        }
    }

    if(datePicker){
        val state=rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest={datePicker=false},
            confirmButton={
                TextButton(onClick={
                    state.selectedDateMillis?.let{
                        onDraft(draft.copy(issueDate=java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneOffset.UTC).toLocalDate().toString()))
                    }
                    datePicker=false
                }){Text("OK")}
            }
        ){DatePicker(state=state)}
    }

    if(invoiceDialog){
        val current=options.numberingSeries.firstOrNull{it.branchId==draft.branchId}?.prefix.orEmpty()
        AlertDialog(
            onDismissRequest={invoiceDialog=false},
            title={Text("Change Invoice No.")},
            text={
                Column{
                    Text("Invoice Prefix")
                    SingleChoiceSegmentedButtonRow{
                        SegmentedButton(
                            selected=current.isBlank(),
                            onClick={onPrefix("");prefixDraft=""},
                            shape=SegmentedButtonDefaults.itemShape(0,2)
                        ){Text("None")}
                        SegmentedButton(
                            selected=current.isNotBlank(),
                            onClick={prefixDraft=current},
                            shape=SegmentedButtonDefaults.itemShape(1,2)
                        ){Text("Add Prefix")}
                    }
                    OutlinedTextField(prefixDraft,{prefixDraft=it},label={Text("Prefix")})
                    Text("Preview updates from the canonical NumberingSeries.")
                }
            },
            confirmButton={
                Button(
                    enabled=!saving,
                    onClick={
                        val normalized=prefixDraft.trim().trimEnd('-').let{if(it.isBlank())"" else "$it-"}
                        onPrefix(normalized)
                        invoiceDialog=false
                    }
                ){Text("SAVE")}
            },
            dismissButton={TextButton(onClick={invoiceDialog=false}){Text("Close")}}
        )
    }

    if(more)ModalBottomSheet(onDismissRequest={more=false}){
        Column(Modifier.fillMaxWidth()){
            Row(Modifier.fillMaxWidth().padding(20.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                Text("More Options",style=MaterialTheme.typography.titleLarge)
                IconButton(onClick={more=false}){Text("×")}
            }
            ListItem(headlineContent={Text("Share")},leadingContent={Text("↗")},modifier=Modifier.clickable{Toast.makeText(context,"Save the sale before sharing.",Toast.LENGTH_SHORT).show()})
            ListItem(headlineContent={Text("Print")},leadingContent={Text("▣")},modifier=Modifier.clickable{Toast.makeText(context,"Save the sale before printing.",Toast.LENGTH_SHORT).show()})
            ListItem(headlineContent={Text("Generate e-Invoice")},leadingContent={Text("▤")},modifier=Modifier.clickable{Toast.makeText(context,"Available after a posted eligible invoice is saved.",Toast.LENGTH_SHORT).show()})
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

@Composable
private fun SalesLineEditor(
    index: Int,
    line: SalesLineDraft,
    draft: SalesEditorDraft,
    options: SalesOptions,
    sourceLines: List<JsonObject>,
    onLine: (Int, SalesLineDraft) -> Unit,
    onRemove: (Int) -> Unit
) {
    var unitError by remember(index) { mutableStateOf<String?>(null) }
    val masters = when (line.lineType) { "PRODUCT" -> options.products; "SERVICE" -> options.services; "WORK_PACKAGE" -> options.workPackages; else -> emptyList() }
    ElevatedCard {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Line ${index + 1}")
            if (draft.type == "CREDIT_NOTE") {
                SelectField("Original line", line.sourceCommercialLineId, sourceLines.map { it.str("id") to "${it.str("itemName")} · ${it.str("quantity")}" }) { id ->
                    val source = sourceLines.first { it.str("id") == id }
                    onLine(index, line.copy(
                        sourceCommercialLineId = id,
                        unitSelection=(source["unitConversionSnapshot"] as? JsonObject)?.str("selection").orEmpty().ifBlank{"PRIMARY"},
                        secondaryUnitsPerBase=(source["unitConversionSnapshot"] as? JsonObject)?.str("secondaryUnitsPerBase").orEmpty(),
                        unitName=source.str("unitName"),unitSymbol=source.str("unitSymbol"),
                        lineType = source.str("lineType"),
                        sourceId = source.str("productId").ifBlank { source.str("serviceId").ifBlank { source.str("workPackageId") } },
                        itemName = source.str("itemName"),
                        quantity = source.str("quantity"),
                        rate = source.str("rate"),
                        taxRate = source.str("taxRate")
                    ))
                }
            }
            SelectField("Type", line.lineType, listOf("PRODUCT" to "Product", "SERVICE" to "Service", "WORK_PACKAGE" to "Work package", "CUSTOM" to "Custom")) { onLine(index, line.copy(quotationUnitReviewRequired=false,lineType = it, sourceId = "",unitSelection="PRIMARY",secondaryUnitsPerBase="",copiedFromSaleLineId="",batchId="",serialNumberId="",servicePeriodDays="",originalLineId="",itemCode="",specification="",cessRate="0")) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { onLine(index, line.copy(itemName = it)) }, label = { Text("Item name") })
            } else {
                SelectField("Item", line.sourceId, masters.map { it.id to it.name }) { id -> val master = masters.first { it.id == id }; val price=com.salespunch360.mobile.account.itemMasterPrice(master,draft.taxMode,draft.type in setOf("PURCHASE_BILL","PURCHASE_ORDER","DEBIT_NOTE"),options.itemWiseDiscount,line.quantity); onLine(index, line.copy(quotationUnitReviewRequired=false,sourceId = id,unitSelection="PRIMARY",secondaryUnitsPerBase="",copiedFromSaleLineId="", rate = price.rate,discountType=price.discountType,discountValue=price.discountValue, taxRate = master.taxRate.orEmpty(),batchId="",serialNumberId="",servicePeriodDays="",originalLineId="",itemCode="",specification="",cessRate="0")) }
            }
            val master=masters.firstOrNull { it.id==line.sourceId }
            if(line.sourceCommercialLineId.isNotBlank()||line.originalLineId.isNotBlank()||line.copiedFromSaleLineId.isNotBlank()) {
                Text("Original unit: ${line.unitSymbol.ifBlank{line.unitName}.ifBlank{line.unitSelection}}")
            } else if(master!=null) {
                val assigned=listOf("PRIMARY" to master.unitId,"SECONDARY" to master.secondaryUnitId).filter { it.first=="PRIMARY"||it.second.isNotBlank() }
                SelectField("Unit",line.unitSelection,assigned.map { (selection,id)-> selection to (options.units.firstOrNull{it.id==id}?.name?:if(selection=="PRIMARY")"Primary"else"Secondary") }) { selection ->
                    runCatching { salesUnitLine(line,master,draft.taxMode,selection,options.itemWiseDiscount,options.units.firstOrNull{it.id==if(selection=="SECONDARY")master.secondaryUnitId else master.unitId}) }
                        .onSuccess { unitError=null;onLine(index,if(line.quotationUnitReviewRequired)it.copy(rate=line.rate,discountType=line.discountType,discountValue=line.discountValue,taxRate=line.taxRate) else it) }.onFailure { unitError=it.message }
                }
            }
            if(line.quotationUnitReviewRequired){Text("Estimate unit: ${line.unitName} ${line.unitSymbol}. Unit labels do not establish a stock conversion.");Row(verticalAlignment=Alignment.CenterVertically){Checkbox(checked=false,onCheckedChange={if(it)onLine(index,line.copy(quotationUnitReviewRequired=false))});Text("I confirm quantity and rate use the selected current unit and warehouse.")}}
            unitError?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(line.quantity, { onLine(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { onLine(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            if(options.itemWiseDiscount)Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SelectField("Discount", line.discountType, listOf("" to "None", "PERCENTAGE" to "%", "FIXED" to "Fixed"), Modifier.weight(1f)) { onLine(index, line.copy(discountType = it)) }
                OutlinedTextField(line.discountValue, { onLine(index, line.copy(discountValue = it)) }, label = { Text("Discount") }, modifier = Modifier.weight(1f))
            }
            val reminder=(options.transactionDefaults["reminderSettings"] as? JsonObject)?.get("service") as? JsonObject
            if(draft.type=="SALES_INVOICE"&&reminder?.get("enabled")?.jsonPrimitive?.booleanOrNull==true&&reminder["allowSalePeriodOverride"]?.jsonPrimitive?.booleanOrNull==true&&(reminder["selectedItemIds"] as? JsonArray)?.any{it.jsonPrimitive.content==line.sourceId}==true){OutlinedTextField(line.servicePeriodDays,{onLine(index,line.copy(servicePeriodDays=it))},label={Text("Service Period (No. of Days)")},placeholder={Text(reminder["periodDays"]?.jsonPrimitive?.content?:"60")},isError=line.servicePeriodDays.isNotBlank()&&line.servicePeriodDays.toIntOrNull() !in 1..3650)}
            OutlinedTextField(line.taxRate, { onLine(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            if (line.sourceId.isNotBlank() && masters.firstOrNull { it.id == line.sourceId }?.trackInventory == true) {
                SelectField("Warehouse", line.warehouseId, options.warehouses.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { onLine(index, line.copy(warehouseId = it)) }
                if(masters.firstOrNull{it.id==line.sourceId}?.trackingMode=="BATCH")SelectField("Batch",line.batchId,options.batches.filter{it.str("productId")==line.sourceId}.map{it.str("id") to it.str("batchNumber")}){onLine(index,line.copy(batchId=it))}
                if(masters.firstOrNull{it.id==line.sourceId}?.trackingMode=="SERIAL")SelectField("Serial Number",line.serialNumberId,options.serials.filter{it.str("productId")==line.sourceId}.map{it.str("id") to it.str("serialNumber")}){onLine(index,line.copy(serialNumberId=it))}
            }
            if (draft.lines.size > 1) TextButton(onClick = { onRemove(index) }) { Text("Remove line") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectField(label: String, value: String, values: List<Pair<String, String>>, modifier: Modifier = Modifier, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = !open }, modifier = modifier) {
        OutlinedTextField(
            value = values.firstOrNull { it.first == value }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
        )
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            values.forEach { (id, text) -> DropdownMenuItem(text = { Text(text) }, onClick = { onChange(id); open = false }) }
        }
    }
}

@Composable
private fun QuotationConversionReference(draft:SalesEditorDraft){
 val reference=draft.quotationReference?:return
 Column(Modifier.fillMaxWidth().padding(8.dp)){
  Text("From estimate ${draft.quotationNumber}",fontWeight=FontWeight.Bold)
  Text(if(draft.type=="SALES_INVOICE")"Save posts this Sale and closes the estimate. Leaving without saving creates no Sale."else"Saving prepares the order. Confirmation closes the estimate without an accounting entry.")
  listOf("terms","inclusions","exclusions","notes").forEach{field->reference.str(field).takeIf{it.isNotBlank()}?.let{Text(it)}}
  reference.array("paymentSchedule").forEach{row->Text("${row.str("label")}: ${accountMoney(row.str("amount"))} ${row.str("dueDescription")}")}
 }
}
