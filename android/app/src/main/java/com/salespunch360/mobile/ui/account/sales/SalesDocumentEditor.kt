package com.salespunch360.mobile.ui.account.sales

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
                enabled = !saving && draft.branchId.isNotBlank() && draft.customerId.isNotBlank() && draft.lines.all {
                    it.quantity.toDoubleOrNull()?.let { quantity -> quantity > 0 } == true && (it.sourceId.isNotBlank() || it.itemName.isNotBlank())
                },
                onClick = { onSave(false) }
            ) { Text(if (saving) "Saving…" else "Create draft") }
        },
        dismissButton = { TextButton(enabled = !saving, onClick = onClose) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item { SelectField("Document type", draft.type, options.types.map { it to it.replace('_', ' ') }) { onDraft(draft.copy(type = it)) } }
                item { SelectField("Branch", draft.branchId, options.branches.map { it.id to it.name }) { onDraft(draft.copy(branchId = it, customerId = "")) } }
                item { SelectField("Customer", draft.customerId, options.customers.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { onDraft(draft.copy(customerId = it)) } }
                if (draft.type == "CREDIT_NOTE") item { SelectField("Original invoice", draft.sourceDocumentId, sources.map { it.str("id") to it.str("documentNumber") }) { onDraft(draft.copy(sourceDocumentId = it)) } }
                item { OutlinedTextField(draft.issueDate, { onDraft(draft.copy(issueDate = it)) }, label = { Text("Issue date (YYYY-MM-DD)") }) }
                item { OutlinedTextField(draft.dueDate, { onDraft(draft.copy(dueDate = it)) }, label = { Text("Due date (optional)") }) }
                item { SelectField("Tax mode", draft.taxMode, listOf("EXCLUSIVE" to "Exclusive", "INCLUSIVE" to "Inclusive")) { onDraft(draft.copy(taxMode = it)) } }
                item { OutlinedTextField(draft.stateOfSupplyCode, { onDraft(draft.copy(stateOfSupplyCode = it)) }, label = { Text("State of supply code") }) }
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
    var cash by rememberSaveable{mutableStateOf(false)}
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
    var more by remember{mutableStateOf(false)}
    var invoiceDialog by remember{mutableStateOf(false)}
    var prefixDraft by remember{mutableStateOf("")}
    var addItemPage by remember{mutableStateOf(false)}
    var datePicker by remember{mutableStateOf(false)}

    var itemName by remember{mutableStateOf("")}
    var itemQty by remember{mutableStateOf("1")}
    var itemUnitId by remember{mutableStateOf("")}
    var itemRate by remember{mutableStateOf("")}
    var itemTaxMode by remember{mutableStateOf("WITHOUT")}
    var itemDescription by remember{mutableStateOf("")}

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
    fun commitItem(stay:Boolean){
        val name=itemName.trim()
        if(name.isBlank())return
        val product=options.products.firstOrNull{it.name.equals(name,true)}
        val service=if(product==null)options.services.firstOrNull{it.name.equals(name,true)} else null
        val unit=options.units.firstOrNull{it.id==itemUnitId}
        val line=SalesLineDraft(
            lineType=if(product!=null)"PRODUCT" else if(service!=null)"SERVICE" else "CUSTOM",
            sourceId=product?.id?:service?.id.orEmpty(),
            itemName=name,
            description=itemDescription,
            unitName=unit?.name.orEmpty(),
            unitSymbol=unit?.symbol.orEmpty(),
            quantity=itemQty.ifBlank{"1"},
            rate=itemRate.ifBlank{product?.rate?:service?.rate.orEmpty()},
            taxRate=product?.taxRate?:service?.taxRate?:"0",
        )
        val emptyIndex=draft.lines.indexOfFirst{it.sourceId.isBlank()&&it.itemName.isBlank()}
        if(emptyIndex>=0)onLine(emptyIndex,line) else {
            onAdd()
            onLine(draft.lines.size,line)
        }
        itemName="";itemQty="1";itemUnitId="";itemRate="";itemTaxMode="WITHOUT";itemDescription=""
        if(!stay)addItemPage=false
    }

    if(addItemPage){
        Scaffold(
            topBar={
                TopAppBar(
                    title={Text("Add Items to Sale")},
                    navigationIcon={IconButton(onClick={addItemPage=false}){Text("←")}},
                    actions={IconButton(onClick={navigate("/workspace/account/settings")}){Icon(Icons.Default.Settings,"Sale settings")}}
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
                item{
                    OutlinedTextField(
                        itemName,
                        {itemName=it},
                        label={Text("Item Name")},
                        placeholder={Text("e.g. Chocolate Cake")},
                        modifier=Modifier.fillMaxWidth()
                    )
                }
                item{
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedTextField(itemQty,{itemQty=it},label={Text("Quantity")},modifier=Modifier.weight(1f))
                        SelectField("Unit",itemUnitId,options.units.map{it.id to "${it.name} (${it.symbol.orEmpty()})"},Modifier.weight(1f)){itemUnitId=it}
                    }
                }
                item{
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedTextField(itemRate,{itemRate=it},label={Text("Rate (Price/Unit)")},modifier=Modifier.weight(1f))
                        SelectField("Tax",itemTaxMode,listOf("WITHOUT" to "Without Tax","WITH" to "With Tax"),Modifier.weight(1f)){itemTaxMode=it}
                    }
                }
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
                    actions={IconButton(onClick={navigate("/workspace/account/settings/custom-fields")}){Text("⚙")}}
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
                                onClick={cash=i==1},
                                shape=SegmentedButtonDefaults.itemShape(i,2)
                            ){Text(label)}
                        }
                    }
                    IconButton(onClick={navigate("/workspace/account/settings")}){Icon(Icons.Default.Settings,"Sale settings")}
                }
            )
        },
        bottomBar={
            Surface(shadowElevation=8.dp){
                Row(
                    Modifier.fillMaxWidth().navigationBarsPadding().padding(10.dp),
                    horizontalArrangement=Arrangement.spacedBy(8.dp)
                ){
                    OutlinedButton(onClick={onSave(true)},enabled=!saving,modifier=Modifier.weight(1f)){Text("Save & New")}
                    Button(onClick={onSave(false)},enabled=!saving,modifier=Modifier.weight(1f)){Text(if(saving)"Saving…" else "Save")}
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
                    Column(Modifier.clickable{invoiceDialog=true}){
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
                        "Project (optional for regular sale)",
                        draft.projectId,
                        options.projects.filter{it.branchId==draft.branchId}.map{it.id to it.name}
                    ){id->onDraft(draft.copy(projectId=id))}
                }
            }
            item{
                OutlinedButton(onClick={customerSheet=true},modifier=Modifier.fillMaxWidth()){
                    Text(options.customers.firstOrNull{it.id==draft.customerId}?.name?:"Search or select customer")
                }
            }
            item{OutlinedTextField("",{},label={Text("Billing Name (Optional)")},modifier=Modifier.fillMaxWidth())}
            item{OutlinedButton(onClick={addItemPage=true},modifier=Modifier.fillMaxWidth()){Text("+ Add Items (Optional)")}}
            itemsIndexed(draft.lines){index,line->
                if(line.sourceId.isNotBlank()||line.itemName.isNotBlank())SalesLineEditor(index,line,draft,options,emptyList(),onLine,onRemove)
            }
            item{
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                    Text("Total Amount",fontWeight=FontWeight.Bold)
                    Text("Server calculated",fontWeight=FontWeight.Bold)
                }
            }
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
                        onDraft(draft.copy(customerId=party.id))
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
             ListItem(headlineContent={Text("Transaction Settings")},leadingContent={Icon(Icons.Default.Settings,null)},modifier=Modifier.clickable{more=false;navigate("/workspace/account/settings/transactions")})
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
    val masters = when (line.lineType) { "PRODUCT" -> options.products; "SERVICE" -> options.services; "WORK_PACKAGE" -> options.workPackages; else -> emptyList() }
    ElevatedCard {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Line ${index + 1}")
            if (draft.type == "CREDIT_NOTE") {
                SelectField("Original line", line.sourceCommercialLineId, sourceLines.map { it.str("id") to "${it.str("itemName")} · ${it.str("quantity")}" }) { id ->
                    val source = sourceLines.first { it.str("id") == id }
                    onLine(index, line.copy(
                        sourceCommercialLineId = id,
                        lineType = source.str("lineType"),
                        sourceId = source.str("productId").ifBlank { source.str("serviceId").ifBlank { source.str("workPackageId") } },
                        itemName = source.str("itemName"),
                        quantity = source.str("quantity"),
                        rate = source.str("rate"),
                        taxRate = source.str("taxRate")
                    ))
                }
            }
            SelectField("Type", line.lineType, listOf("PRODUCT" to "Product", "SERVICE" to "Service", "WORK_PACKAGE" to "Work package", "CUSTOM" to "Custom")) { onLine(index, line.copy(lineType = it, sourceId = "")) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { onLine(index, line.copy(itemName = it)) }, label = { Text("Item name") })
            } else {
                SelectField("Item", line.sourceId, masters.map { it.id to it.name }) { id -> val master = masters.first { it.id == id }; onLine(index, line.copy(sourceId = id, rate = master.rate.orEmpty(), taxRate = master.taxRate.orEmpty())) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(line.quantity, { onLine(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { onLine(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SelectField("Discount", line.discountType, listOf("" to "None", "PERCENTAGE" to "%", "FIXED" to "Fixed"), Modifier.weight(1f)) { onLine(index, line.copy(discountType = it)) }
                OutlinedTextField(line.discountValue, { onLine(index, line.copy(discountValue = it)) }, label = { Text("Discount") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(line.taxRate, { onLine(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            if (line.sourceId.isNotBlank() && masters.firstOrNull { it.id == line.sourceId }?.trackInventory == true) {
                SelectField("Warehouse", line.warehouseId, options.warehouses.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { onLine(index, line.copy(warehouseId = it)) }
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
