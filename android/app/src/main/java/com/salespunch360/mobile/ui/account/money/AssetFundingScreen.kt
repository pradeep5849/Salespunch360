package com.salespunch360.mobile.ui.account.money

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.account.accountMoney
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

@Composable
fun AssetFundingScreen(padding:PaddingValues,query:String,onBack:()->Unit) {
    val context=LocalContext.current
    val api=remember(context){ApiClient(SecureSession(context))}
    val scope=rememberCoroutineScope()
    var data by remember(query){mutableStateOf<JsonObject?>(null)}
    var canWrite by remember(query){mutableStateOf(false)}
    var loading by remember{mutableStateOf(false)}
    var saving by remember{mutableStateOf(false)}
    var error by remember{mutableStateOf<String?>(null)}
    var search by rememberSaveable(query){mutableStateOf("")}
    var assetId by rememberSaveable(query){mutableStateOf("")}
    var contributionId by rememberSaveable(query){mutableStateOf("")}
    var amount by rememberSaveable(query){mutableStateOf("")}
    var date by rememberSaveable(query){mutableStateOf(java.time.LocalDate.now().toString())}
    var confirmed by rememberSaveable(query){mutableStateOf(false)}
    var reason by rememberSaveable(query){mutableStateOf("")}
    // Retain the exact request across retries and configuration changes.
    var pending by rememberSaveable(query){mutableStateOf<String?>(null)}
    fun load() { if(loading||saving)return;loading=true;error=null;scope.launch{try{val money=api.moneyContext(query);canWrite=money["capabilities"]?.jsonObject?.get("postMoneyEntries")?.jsonPrimitive?.booleanOrNull==true;data=api.assetFundingOptions(query,search)}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Funding could not be loaded. Reconnect and retry."}finally{loading=false}} }
    fun submit(request:JsonObject) { if(saving)return;pending=request.toString();saving=true;error=null;scope.launch{try{api.mutateAssetFunding(request);pending=null;amount="";confirmed=false;reason="";data=api.assetFundingOptions(query,search)}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Result not confirmed. Retry the same request.";if(e is ApiException&&e.status in listOf(400,403,409))pending=null}finally{saving=false}} }
    LaunchedEffect(query){load()}
    val assets=data?.array("summary").orEmpty()
    val asset=assets.firstOrNull{it.jsonObject.str("id")==assetId}?.jsonObject
    val sources=data?.array("sources").orEmpty().filter{it.jsonObject.str("branchId")==asset?.str("branchId")}
    val source=sources.firstOrNull{it.jsonObject.str("id")==contributionId}?.jsonObject
    val editable=canWrite&&!saving&&!loading&&pending==null
    fun envelope(operation:String,payload:JsonObject)=buildJsonObject{put("operation",operation);put("payload",payload)}
    LazyColumn(Modifier.padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
        item{Text("Asset funding",style=MaterialTheme.typography.headlineSmall);TextButton(onBack,enabled=!saving){Text("Back to capital")}}
        item{Text("Funding attributes existing owner contributions. It does not add asset cost or post another cash entry.")}
        if(loading||saving)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
        error?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}}
        if(pending!=null)item{Button({submit(Json.parseToJsonElement(pending!!).jsonObject)},enabled=!saving){Text("Retry same request")};Text("Editing is locked until this request is confirmed.")}
        item{OutlinedTextField(search,{search=it},label={Text("Search posted contributions")},enabled=!loading&&!saving);TextButton({load()},enabled=!loading&&!saving){Text("Refresh / search")}}
        items(assets){entry->val row=entry.jsonObject
            ElevatedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){
                Text(row.str("name"),style=MaterialTheme.typography.titleMedium)
                Text("Purchase cost: "+accountMoney(row.str("purchaseValue")))
                Text("Recorded owner funding: "+accountMoney(row.str("ownerFunded")))
                Text(if(row.str("fundingStatus")=="CONFIRMED")"Company funding: "+accountMoney(row.str("companyFunded"))else "Funding classification requires confirmation")
                TextButton({assetId=row.str("id");contributionId="";amount="";confirmed=false;reason=""},enabled=editable){Text(if(assetId==row.str("id"))"Selected"else "Select asset")}
            }}
        }
        if(asset!=null){
            item{Text("Selected: "+asset.str("name"));OutlinedTextField(reason,{reason=it},label={Text("Classification / correction reason")},enabled=editable)}
            item{Row{Checkbox(confirmed,{confirmed=it},enabled=editable);Text("Confirm the remaining purchase cost is company funded")}}
            item{Row{
                TextButton({submit(envelope("CONFIRM",buildJsonObject{put("assetId",assetId);put("branchId",asset.str("branchId"));put("expectedPurchaseValue",asset.str("purchaseValue"));put("confirmed",true);put("reason",reason);put("requestKey",java.util.UUID.randomUUID().toString())}))},enabled=editable&&confirmed&&reason.trim().length>=3){Text("Confirm funding")}
                TextButton({submit(envelope("CONFIRM",buildJsonObject{put("assetId",assetId);put("branchId",asset.str("branchId"));put("expectedPurchaseValue",asset.str("purchaseValue"));put("confirmed",false);put("reason",reason);put("requestKey",java.util.UUID.randomUUID().toString())}))},enabled=editable&&reason.trim().length>=3){Text("Clear classification")}
            }}
            item{FundingSourcePicker(contributionId,sources,editable){contributionId=it}}
            item{OutlinedTextField(amount,{amount=it},label={Text("Owner-funded amount")},enabled=editable);OutlinedTextField(date,{date=it},label={Text("Allocation date (YYYY-MM-DD)")},enabled=editable)}
            item{Button({submit(envelope("ALLOCATE",buildJsonObject{put("branchId",asset.str("branchId"));put("assetId",assetId);put("ownerFinancialAccountId",source!!.str("ownerFinancialAccountId"));put("contributionTransactionId",contributionId);put("amount",amount);put("allocationDate",date);put("expectedPurchaseValue",asset.str("purchaseValue"));put("confirmCompanyRemainder",true);put("requestKey",java.util.UUID.randomUUID().toString())}))},enabled=editable&&confirmed&&source!=null&&amount.toBigDecimalOrNull()?.signum()==1&&date.isNotBlank()){Text("Allocate existing contribution")}}
            items(asset.array("fundings")){entry->val row=entry.jsonObject
                Column{
                    Text(row.str("ownerName")+" · remaining "+accountMoney(row.str("remainingAmount")))
                    TextButton({submit(envelope("CANCEL",buildJsonObject{put("fundingId",row.str("id"));put("reason",reason);put("expectedPurchaseValue",asset.str("purchaseValue"));put("confirmCompanyRemainder",true);put("requestKey",java.util.UUID.randomUUID().toString())}))},enabled=editable&&confirmed&&reason.trim().length>=3){Text("Correct allocation")}
                }
            }
        }
        item{Text("Allocation history",style=MaterialTheme.typography.titleMedium)}
        items(data?.array("history").orEmpty()){entry->val row=entry.jsonObject;Text(row.str("assetName")+" · "+row.str("ownerName")+" · "+accountMoney(row.str("amount"))+if(row["cancellation"] is JsonObject)" · corrected"else "")}
    }
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FundingSourcePicker(value:String,rows:List<JsonElement>,enabled:Boolean,onSelect:(String)->Unit){
 var open by remember{mutableStateOf(false)}
 @Composable fun label(row:JsonObject)=row.str("ownerName")+" · "+row.str("number")+" · "+accountMoney(row.str("amount"))
 ExposedDropdownMenuBox(open,{if(enabled)open=it}){
  val selected=rows.firstOrNull{it.jsonObject.str("id")==value}?.jsonObject
  OutlinedTextField(if(selected!=null)label(selected)else "",{},readOnly=true,label={Text("Posted owner contribution")},enabled=enabled,modifier=Modifier.menuAnchor())
  ExposedDropdownMenu(open,{open=false}){rows.forEach{entry->val row=entry.jsonObject;DropdownMenuItem({Text(label(row))},{onSelect(row.str("id"));open=false})}}
 }
}
