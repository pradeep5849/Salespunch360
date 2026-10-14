package com.salespunch360.mobile.ui.account

import com.salespunch360.mobile.ui.account.accountMoney
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountMasterViewModel
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.MutationFeedback
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.putJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.booleanOrNull

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AccountMasterScreen(kind:String,contentPadding:PaddingValues,vm:AccountMasterViewModel=viewModel(),initialCreate:Boolean=false,canCreate:Boolean=true,initialBranchId:String?=null,onCreated:(String?)->Unit={},onCancel:()->Unit={}){
 LaunchedEffect(kind,initialCreate,initialBranchId){vm.open(kind);if(initialCreate&&canCreate)vm.beginCreate(initialBranchId)}
 val state=vm.state.collectAsStateWithLifecycle().value
 LaunchedEffect(state.message,initialCreate){if(initialCreate&&state.message=="Saved successfully."&&vm.state.value.message==state.message)onCreated(state.createdBranchId)}
 Column(Modifier.fillMaxSize().padding(contentPadding).padding(horizontal=16.dp)){
  MutationFeedback(state.message,state.error,vm::clearFeedback)
  if(initialCreate){
   Text("New Party",style=MaterialTheme.typography.headlineSmall)
   if(!canCreate)Text("Account party creation is not available to your role.")
   Row{TextButton(onCancel,enabled=!state.saving){Text("Return to Home")};if(state.error!=null&&canCreate)TextButton(vm::refresh,enabled=!state.loading&&!state.saving){Text("Retry")}}
  }else{
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    OutlinedTextField(state.query,{vm.search(it)},label={Text("Search")},singleLine=true,modifier=Modifier.weight(1f))
    IconButton(vm::refresh,enabled=!state.saving){Icon(Icons.Default.Refresh,"Refresh")}
    FilledIconButton({vm.edit(AccountMasterRecord(id="",name="",branchId=state.options.branches.firstOrNull()?.id))},enabled=canCreate&&!state.loading&&!state.saving){Icon(Icons.Default.Add,"Create")}
   }
   Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("true" to "Active","false" to "Inactive","all" to "All").forEach{(value,label)->FilterChip(state.active==value,{vm.filter(value)},{Text(label)})}}
  }
  if(state.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  if(!initialCreate)LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(vertical=8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   if(!state.loading&&state.error==null&&state.records.isEmpty())item{Text("No ${kind.replace('-',' ')} found.",modifier=Modifier.padding(24.dp))}
   items(state.records,key={it.id}){record->ElevatedCard(Modifier.fillMaxWidth().clickable{vm.detail(record)}){ListItem(headlineContent={Text(record.name,fontWeight=FontWeight.SemiBold)},supportingContent={Text(summary(kind,record))},trailingContent={IconButton({vm.edit(record)},enabled=canCreate&&!state.saving){Icon(Icons.Default.Edit,"Edit ${record.name}")}})}}
  }
 }
 state.editing?.let{MasterEditor(kind,it,state.options,state.saving,{if(!state.saving){vm.edit(null);if(initialCreate)onCancel()}},vm::save)}
 state.selected?.let{PartyDetail(it,vm::closeDetail){vm.edit(it.record)}}
}

@Composable private fun ErrorCard(message:String,retry:()->Unit){Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.errorContainer),modifier=Modifier.fillMaxWidth().padding(vertical=8.dp)){Row(Modifier.padding(12.dp)){Text(message,Modifier.weight(1f));TextButton(retry){Text("Retry")}}}}
@Composable private fun summary(kind:String,r:AccountMasterRecord)=when(kind){"customers","vendors"->listOfNotNull(r.contactPerson,r.phone,r.email,r.gstin).joinToString(" · ").ifBlank{"No contact details"};"items"->listOfNotNull(r.code,r.salePrice?.let{"Sale ₹$it"},r.costPrice?.let{"Cost ₹$it"},if(r.trackInventory)r.trackingMode else null).joinToString(" · ");else->listOfNotNull(r.code,r.address,if(r.isDefault)"Default" else null).joinToString(" · ")}

@Composable private fun PartyDetail(detail:AccountPartyDetail,onClose:()->Unit,onEdit:()->Unit){AlertDialog(onDismissRequest=onClose,confirmButton={TextButton(onEdit){Text("Edit")}},dismissButton={TextButton(onClose){Text("Close")}},title={Text(detail.record.name)},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){item{Text(summary("customers",detail.record));detail.record.address?.let{Text(it)};detail.record.shippingAddress?.let{Text("Shipping: $it")}};if(detail.documents.isNotEmpty())item{Text("Transactions",fontWeight=FontWeight.Bold)};items(detail.documents){Text("${it.documentNumber} · ${it.type.replace('_',' ')} · ${accountMoney(it.grandTotal.orEmpty())} · ${it.status}")};items(detail.settlements){Text("${it.settlementNumber} · ${accountMoney(it.amount.orEmpty())}")}}})}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun MasterEditor(kind:String,source:AccountMasterRecord,options:AccountMasterOptions,saving:Boolean,onClose:()->Unit,onSave:(kotlinx.serialization.json.JsonObject)->Unit){var name by remember(source){mutableStateOf(source.name)};var code by remember(source){mutableStateOf(source.code.orEmpty())};var contact by remember(source){mutableStateOf(source.contactPerson.orEmpty())};var phone by remember(source){mutableStateOf(source.phone.orEmpty())};var email by remember(source){mutableStateOf(source.email.orEmpty())};var address by remember(source){mutableStateOf(source.address.orEmpty())};var shipping by remember(source){mutableStateOf(source.shippingAddress.orEmpty())};var gstin by remember(source){mutableStateOf(source.gstin.orEmpty())};var stateCode by remember(source){mutableStateOf(source.stateCode.orEmpty())};var pan by remember(source){mutableStateOf(source.pan.orEmpty())};var notes by remember(source){mutableStateOf(source.notes.orEmpty())};var branchId by remember(source){mutableStateOf(source.branchId?:options.branches.firstOrNull()?.id.orEmpty())};var sale by remember(source){mutableStateOf(source.salePrice.orEmpty())};var cost by remember(source){mutableStateOf(source.costPrice.orEmpty())};var tax by remember(source){mutableStateOf(source.taxRate.orEmpty())};var barcode by remember(source){mutableStateOf(source.barcode.orEmpty())};var hsn by remember(source){mutableStateOf(source.hsnCode.orEmpty())};var threshold by remember(source){mutableStateOf(source.lowStockThreshold?:"0")};var track by remember(source){mutableStateOf(source.trackInventory)};var default by remember(source){mutableStateOf(source.isDefault)};var active by remember(source){mutableStateOf(source.isActive)};var customValues by remember(source){mutableStateOf(source.customValues)};var description by remember(source){mutableStateOf(source.description.orEmpty())};var categoryId by remember(source){mutableStateOf(source.categoryId.orEmpty())};var unitId by remember(source){mutableStateOf(source.unitId.orEmpty())};var trackingMode by remember(source){mutableStateOf(source.trackingMode)}
 AlertDialog(onDismissRequest={if(!saving)onClose()},confirmButton={Button(enabled=!saving&&name.isNotBlank()&&options.partyCustomFields.filter{it.isRequired}.all{!customValues[it.fieldKey].isNullOrBlank()}&&(kind !in listOf("customers","warehouses")||branchId.isNotBlank()),onClick={onSave(buildJsonObject{put("name",name);put("isActive",active);when(kind){"customers","vendors"->{if(kind=="customers")put("branchId",branchId);put("contactPerson",contact);put("phone",phone);put("email",email);put("address",address);if(kind=="customers")put("shippingAddress",shipping);put("gstin",gstin);put("stateCode",stateCode);put("gstRegistrationType",source.gstRegistrationType?:"UNREGISTERED");put("pan",pan);put("notes",notes);putJsonObject("customFields"){customValues.forEach{put(it.key,it.value)}}};"items"->{put("code",code);if(options.itemSettings["description"]?.jsonPrimitive?.booleanOrNull!=false)put("description",description);if(options.itemSettings["itemCategory"]?.jsonPrimitive?.booleanOrNull!=false&&categoryId.isNotBlank())put("categoryId",categoryId);if(options.itemSettings["itemUnits"]?.jsonPrimitive?.booleanOrNull!=false&&unitId.isNotBlank())put("unitId",unitId);put("sellingRate",sale);put("cost",cost);put("taxRate",tax);put("barcode",barcode);put("hsnSacCode",hsn);put("trackInventory",track);put("trackingMode",if(track)trackingMode else "NONE");put("lowStockThreshold",threshold);putJsonObject("customFields"){customValues.forEach{put(it.key,it.value)}}};"warehouses"->{put("branchId",branchId);put("code",code);put("address",address);put("isDefault",default)}}})}){Text(if(saving)"Saving…" else "Save")}},dismissButton={TextButton(enabled=!saving,onClick=onClose){Text("Cancel")}},title={Text(if(source.id.isBlank())"New ${kind.dropLastWhile{it=='s'}}" else "Edit ${source.name}")},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){item{OutlinedTextField(name,{name=it},label={Text("Name")},singleLine=true,isError=name.isBlank())};if(kind in listOf("customers","vendors")){if(kind=="customers")item{SimpleSelect("Branch",branchId,options.branches.map{it.id to it.name}){branchId=it}};item{OutlinedTextField(contact,{contact=it},label={Text("Contact person")})};item{OutlinedTextField(phone,{phone=it},label={Text("Phone")})};item{OutlinedTextField(email,{email=it},label={Text("Email")})};item{OutlinedTextField(address,{address=it},label={Text("Address")})};if(kind=="customers"&&options.partySettings.shippingAddressEnabled)item{OutlinedTextField(shipping,{shipping=it},label={Text("Shipping address")})};if(options.partySettings.gstinEnabled){item{OutlinedTextField(gstin,{gstin=it.uppercase()},label={Text("GSTIN / TIN / VATIN")})};item{OutlinedTextField(stateCode,{stateCode=it},label={Text("State code")})};item{OutlinedTextField(pan,{pan=it.uppercase()},label={Text("PAN")})}};item{OutlinedTextField(notes,{notes=it},label={Text("Notes")})}}else{item{OutlinedTextField(code,{code=it.uppercase()},label={Text("Code")})};if(kind=="items"){if(options.itemSettings["description"]?.jsonPrimitive?.booleanOrNull!=false)item{OutlinedTextField(description,{description=it},label={Text("Description")},enabled=!saving)};if(options.itemSettings["itemCategory"]?.jsonPrimitive?.booleanOrNull!=false)item{SimpleSelect("Category",categoryId,options.categories.map{it.id to it.name}){categoryId=it}};if(options.itemSettings["itemUnits"]?.jsonPrimitive?.booleanOrNull!=false)item{SimpleSelect("Unit",unitId,options.units.map{it.id to it.name}){unitId=it}};item{OutlinedTextField(sale,{sale=it},label={Text("Sale rate")})};item{OutlinedTextField(cost,{cost=it},label={Text("Cost rate")})};item{OutlinedTextField(tax,{tax=it},label={Text("Tax %")})};item{OutlinedTextField(barcode,{barcode=it},label={Text("Barcode")})};item{OutlinedTextField(hsn,{hsn=it},label={Text("HSN")})};item{OutlinedTextField(threshold,{threshold=it},label={Text("Low-stock threshold")})};item{Row{Checkbox(track,{track=it});Text("Track inventory",Modifier.padding(top=12.dp))}};if(track)item{SimpleSelect("Tracking mode",trackingMode,listOf("NONE" to "Quantity only","BATCH" to "Batch","SERIAL" to "Serial")){trackingMode=it}}}else{item{SimpleSelect("Branch",branchId,options.branches.map{it.id to it.name}){branchId=it}};item{OutlinedTextField(address,{address=it},label={Text("Address")})};item{Row{Checkbox(default,{default=it});Text("Default warehouse",Modifier.padding(top=12.dp))}}}};items(options.partyCustomFields){field->val value=customValues[field.fieldKey].orEmpty();val label=field.label+if(field.isRequired)" *"else "";if(field.dataType in listOf("SELECT","BOOLEAN"))SimpleSelect(label,value,listOf("" to "Select")+(if(field.dataType=="BOOLEAN")listOf("true" to "Yes","false" to "No")else field.options.map{it to it})){v->customValues=customValues+(field.fieldKey to v)}else OutlinedTextField(value,{v->customValues=customValues+(field.fieldKey to v)},label={Text(if(field.dataType=="DATE")"$label (YYYY-MM-DD)"else label)},singleLine=field.dataType!="TEXTAREA",isError=field.isRequired&&value.isBlank())};if(source.id.isNotBlank())item{Row{Checkbox(active,{active=it});Text("Active",Modifier.padding(top=12.dp))}}}})
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun SimpleSelect(label:String,value:String,items:List<Pair<String,String>>,onChange:(String)->Unit){var open by remember{mutableStateOf(false)};ExposedDropdownMenuBox(open,{open=!open}){OutlinedTextField(items.firstOrNull{it.first==value}?.second.orEmpty(),{},readOnly=true,label={Text(label)},modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable));ExposedDropdownMenu(open,{open=false}){items.forEach{item->DropdownMenuItem({Text(item.second)},{onChange(item.first);open=false})}}}}
