package com.salespunch360.mobile.ui.account.accounting

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountAssetViewModel
import com.salespunch360.mobile.account.*
import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.serialization.json.*

@Composable fun AssetScreen(padding:PaddingValues,vm:AccountAssetViewModel=viewModel()){
 val s=vm.state.collectAsStateWithLifecycle().value
 Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)){
  Row{OutlinedTextField(s.query,vm::search,label={Text("Search assets")},modifier=Modifier.weight(1f));IconButton(vm::refresh){Icon(Icons.Default.Refresh,"Refresh")};FilledIconButton(vm::create,enabled=!s.saving){Icon(Icons.Default.Add,"New asset")}}
  LazyRow{items(listOf<String?>(null,"ACTIVE","ASSIGNED","UNDER_MAINTENANCE","DISPOSED","RETIRED")){v->FilterChip(s.status==v,{vm.filter(v)},{Text(v?.replace('_',' ')?:"All")})}}
  if(s.loading||s.saving)LinearProgressIndicator(Modifier.fillMaxWidth())
  s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)};s.message?.let{Text(it)}
  if(!s.loading&&s.rows.isEmpty())Text(if(s.query.isBlank()&&s.status==null)"No assets yet. Add an asset to track its value, assignments, and history." else "No assets match these filters.")
  LazyColumn(modifier=Modifier.weight(1f)){items(s.rows,key={it.str("id")}){x->ListItem(headlineContent={Text("${x.str("assetNumber")} · ${x.str("name")}",fontWeight=FontWeight.Bold)},supportingContent={Text("${x.str("assetType")} · ${x.str("depreciationMethod")} · ₹${x.str("purchaseValue")}")},trailingContent={Text(x.str("status"))},modifier=Modifier.clickable(enabled=!s.saving){vm.open(x.str("id"))})};if(s.hasMore)item{OutlinedButton(vm::more,enabled=!s.loading){Text("Load more assets")}}}
 }
 if(s.editing!=null)AssetEditor(s.editing,s.options,s.saving,s.error,vm::close,vm::save)
 else s.detail?.let{AssetDetail(it,s.options,s.saving,s.error,vm::close,vm::edit,vm::action)}
}

@Composable private fun AssetEditor(x:JsonObject,o:JsonObject,saving:Boolean,error:String?,close:()->Unit,save:(JsonObject,Boolean)->Unit){
 val edit=x.containsKey("id")
 val values=remember(x){mutableStateMapOf<String,String>().apply{x.forEach{(k,v)->put(k,(v as? JsonPrimitive)?.contentOrNull.orEmpty())};putIfAbsent("assetType","EQUIPMENT");putIfAbsent("purchaseDate",java.time.LocalDate.now().toString());putIfAbsent("depreciationMethod","NONE");putIfAbsent("salvageValue","0");listOf("purchaseDate","depreciationStartDate","effectiveDate").forEach{k->this[k]=get(k).orEmpty().take(10)}}}
 fun get(key:String)=values[key].orEmpty()
 fun put(key:String,v:String){values[key]=v}
 val purchases=o.array("purchases").map{it.jsonObject}.filter{it.str("branchId")==get("branchId")&&(get("vendorId").isBlank()||it.str("vendorId")==get("vendorId"))}
 val purchase=purchases.firstOrNull{it.str("id")==get("purchaseDocumentId")}
 val line=purchase?.array("lines")?.map{it.jsonObject}?.firstOrNull{it.str("id")==get("purchaseDocumentLineId")}
 val opening=runCatching{if(get("openingQuantity").isBlank()||get("unitPrice").isBlank())null else BigDecimal(get("openingQuantity")).multiply(BigDecimal(get("unitPrice"))).setScale(2,RoundingMode.HALF_UP).toPlainString()}.getOrNull()
 val effectiveValue=line?.str("taxableAmount")?:opening?:get("purchaseValue")
 val nullable=listOf("category","hsnCode","openingQuantity","unitPrice","effectiveDate","vendorId","purchaseDocumentId","purchaseDocumentLineId","description","serialNumber","registrationNumber","makeModel","manufactureYear","location","usefulLifeMonths","depreciationStartDate","assetLedgerId","accumulatedDepreciationLedgerId","depreciationExpenseLedgerId")
 fun payload()=buildJsonObject{if(!edit)put("branchId",get("branchId"));listOf("name","assetType","purchaseDate","depreciationMethod","salvageValue").forEach{put(it,get(it))};put("purchaseValue",effectiveValue);nullable.forEach{k->if(get(k).isNotBlank())put(k,get(k))else if(edit)put(k,JsonNull)}}
 val canSave=!saving&&get("name").isNotBlank()&&effectiveValue.isNotBlank()&&get("branchId").isNotBlank()
 AlertDialog(onDismissRequest={if(!saving)close()},title={Text(if(edit)"Edit asset" else "New asset")},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
  item{Text("Asset number: ${x.str("assetNumber").ifBlank{"Assigned automatically when saved"}}")}
  item{OutlinedTextField(get("name"),{put("name",it)},label={Text("Asset name *")},enabled=!saving)}
  item{TextOption("Asset type",get("assetType"),listOf("VEHICLE","EQUIPMENT","FURNITURE","COMPUTER","TOOL","OTHER")){put("assetType",it)}}
  item{OutlinedTextField(get("category"),{put("category",it)},label={Text("Category")},enabled=!saving)}
  if(!edit)item{Option("Branch",get("branchId"),o.array("branches")){put("branchId",it);put("purchaseDocumentId","");put("purchaseDocumentLineId","")}}
  item{OutlinedTextField(get("hsnCode"),{put("hsnCode",it)},label={Text("HSN code (4, 6, or 8 digits)")},enabled=!saving)}
  if(o.array("hsnCodes").isNotEmpty())item{TextOption("Used company HSN codes",get("hsnCode"),o.array("hsnCodes").map{it.jsonPrimitive.content}){put("hsnCode",it)}}
  item{OutlinedTextField(get("purchaseDate"),{put("purchaseDate",it)},label={Text("Purchase date (YYYY-MM-DD) *")},enabled=!saving)}
  item{Option("Vendor",get("vendorId"),listOf(buildJsonObject{put("id","");put("name","None")})+o.array("vendors")){put("vendorId",it);put("purchaseDocumentId","");put("purchaseDocumentLineId","")}}
  item{Option("Posted purchase bill",get("purchaseDocumentId"),listOf(buildJsonObject{put("id","");put("name","None")})+purchases.map{JsonObject(it+mapOf("name" to JsonPrimitive("${it.str("documentNumber")} · ${it.str("partyName")}")))} ){put("purchaseDocumentId",it);put("purchaseDocumentLineId","")}}
  item{Option("Purchase line",get("purchaseDocumentLineId"),listOf(buildJsonObject{put("id","");put("name","None")})+(purchase?.array("lines")?.map{val l=it.jsonObject;JsonObject(l+mapOf("name" to JsonPrimitive("${l.str("itemName")} · ₹${l.str("taxableAmount")}")))}?:emptyList())){put("purchaseDocumentLineId",it)}}
  item{OutlinedTextField(effectiveValue,{put("purchaseValue",it)},readOnly=line!=null||opening!=null,label={Text("Effective purchase value *")},enabled=!saving)}
  if(line!=null)item{Text("Value is the selected posted purchase line value, excluding tax.")}
  items(listOf("openingQuantity" to "Opening quantity","unitPrice" to "Price per unit","effectiveDate" to "As of / effective date (YYYY-MM-DD)","description" to "Description","serialNumber" to "Serial number","registrationNumber" to "Registration number","makeModel" to "Make / model","manufactureYear" to "Manufacture year","location" to "Location")){(key,label)->OutlinedTextField(get(key),{put(key,it)},label={Text(label)},enabled=!saving)}
  item{TextOption("Depreciation method",get("depreciationMethod"),listOf("NONE","STRAIGHT_LINE","WRITTEN_DOWN_VALUE")){put("depreciationMethod",it)}}
  items(listOf("usefulLifeMonths" to "Useful life in months","salvageValue" to "Salvage value","depreciationStartDate" to "Depreciation start date (YYYY-MM-DD)")){(key,label)->OutlinedTextField(get(key),{put(key,it)},label={Text(label)},enabled=!saving)}
  items(listOf("assetLedgerId" to "Asset ledger","accumulatedDepreciationLedgerId" to "Accumulated depreciation ledger","depreciationExpenseLedgerId" to "Depreciation expense ledger")){(key,label)->Option(label,get(key),listOf(buildJsonObject{put("id","");put("name","None")})+o.array("ledgers").filter{it.jsonObject.str("accountClass")==if(key=="depreciationExpenseLedgerId")"EXPENSE" else "ASSET"}){put(key,it)}}
  error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}}
 }},confirmButton={Column{Button(enabled=canSave,onClick={save(payload(),false)}){Text(if(saving)"Saving…" else "Save")};if(!edit)OutlinedButton(enabled=canSave,onClick={save(payload(),true)}){Text("Save & New")}}},dismissButton={TextButton(close,enabled=!saving){Text("Cancel")}})
}

@Composable private fun AssetDetail(d:JsonObject,o:JsonObject,saving:Boolean,error:String?,close:()->Unit,edit:()->Unit,action:(String,JsonObject)->Unit){
 val x=d["asset"]!!.jsonObject
 var user by remember(x){mutableStateOf("")};var notes by remember(x){mutableStateOf("")};var status by remember(x){mutableStateOf(x.str("status"))}
 val names=d.array("people").map{it.jsonObject}.associate{it.str("id") to it.str("name")}
 val users=o.array("users").filter{val u=it.jsonObject;u.str("branchAccessScope")=="ALL_BRANCHES"||u.array("branchAccesses").any{it.jsonObject.str("branchId")==x.str("branchId")}}
 val fields=listOf("name" to "Name","assetType" to "Asset type","status" to "Status","purchaseDate" to "Purchase date","purchaseValue" to "Purchase value","hsnCode" to "HSN code","openingQuantity" to "Opening quantity","unitPrice" to "Price per unit","effectiveDate" to "Effective date","category" to "Category","description" to "Description","serialNumber" to "Serial number","registrationNumber" to "Registration number","makeModel" to "Make / model","manufactureYear" to "Manufacture year","location" to "Location","depreciationMethod" to "Depreciation method","usefulLifeMonths" to "Useful life in months","salvageValue" to "Salvage value","depreciationStartDate" to "Depreciation start date")
 AlertDialog(onDismissRequest={if(!saving)close()},title={Text(x.str("assetNumber"))},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
  items(fields){(key,label)->Text("$label: ${x.str(key).ifBlank{"Not set"}}")}
  item{Text("Assigned to: ${names[x.str("assignedUserId")]?:"Unassigned"}")}
  items(listOf("vendorId" to "Vendor","purchaseDocumentId" to "Purchase bill","purchaseDocumentLineId" to "Purchase line","assetLedgerId" to "Asset ledger","accumulatedDepreciationLedgerId" to "Accumulated depreciation ledger","depreciationExpenseLedgerId" to "Depreciation expense ledger")){(key,label)->val source=when(key){"vendorId"->o.array("vendors");"purchaseDocumentId"->o.array("purchases");"purchaseDocumentLineId"->o.array("purchases").flatMap{it.jsonObject.array("lines")};else->o.array("ledgers")};val item=source.map{it.jsonObject}.firstOrNull{it.str("id")==x.str(key)};Text("$label: ${item?.str("name")?.ifBlank{item.str("documentNumber").ifBlank{item.str("itemName")}}?:"Not set"}")}
  item{Text("Assignment history",fontWeight=FontWeight.Bold)}
  items(d.array("history")){h->val a=h.jsonObject;Text("${names[a.str("assignedToId")]?:"Unavailable employee"} · Assigned by ${names[a.str("assignedById")]?:"Unavailable user"}\n${a.str("assignedAt")} — ${a.str("returnedAt").ifBlank{"Current"}}\n${a.str("notes")}")}
  item{Text("Lifecycle history",fontWeight=FontWeight.Bold)}
  items(d.array("events")){e->val event=e.jsonObject;val m=event["metadata"] as? JsonObject;Text("${event.str("eventType").replace('_',' ')} · ${names[event.str("actorUserId")]?:"Unavailable user"} · ${event.str("createdAt")}\n${m?.str("returnNotes").orEmpty()}${m?.str("status").orEmpty()}")}
  if(x.str("status") in listOf("ACTIVE","ASSIGNED"))item{Option("Assign employee",user,users){user=it}}
  if(x.str("status")!="DISPOSED")item{OutlinedTextField(notes,{notes=it},label={Text("Assignment / return notes")},enabled=!saving)}
  if(x.str("status") !in listOf("ASSIGNED","DISPOSED"))item{TextOption("Change status",status,listOf("ACTIVE","UNDER_MAINTENANCE","RETIRED","DISPOSED")){status=it};if(status=="DISPOSED")Text("A disposed asset cannot be reactivated.");OutlinedButton(enabled=!saving,onClick={action(x.str("id"),buildJsonObject{put("action","STATUS");put("status",status)})}){Text("Update status")}}
  if(x.str("status") in listOf("ACTIVE","ASSIGNED"))item{OutlinedButton(enabled=!saving&&user.isNotBlank(),onClick={action(x.str("id"),buildJsonObject{put("action","ASSIGN");put("userId",user);put("notes",notes)})}){Text(if(x.str("status")=="ASSIGNED")"Reassign" else "Assign")}}
  if(x.str("status")=="ASSIGNED")item{OutlinedButton(enabled=!saving,onClick={action(x.str("id"),buildJsonObject{put("action","RETURN");put("notes",notes)})}){Text("Return asset")}}
  error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}}
 }},confirmButton={Button(edit,enabled=!saving){Text("Edit asset")}},dismissButton={TextButton(close,enabled=!saving){Text("Close")}})
}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun TextOption(label:String,value:String,values:List<String>,set:(String)->Unit){var open by remember{mutableStateOf(false)};ExposedDropdownMenuBox(open,{open=it}){OutlinedTextField(value,{},readOnly=true,label={Text(label)},modifier=Modifier.menuAnchor());ExposedDropdownMenu(open,{open=false}){values.forEach{v->DropdownMenuItem({Text(v.replace('_',' '))},{set(v);open=false})}}}}
