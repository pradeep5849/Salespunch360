package com.salespunch360.mobile.ui.account.money

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.account.accountMoney
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import java.util.UUID

@Composable
fun PartyTransferScreen(padding:PaddingValues,navigate:(String)->Unit,onBack:()->Unit){
 val context=LocalContext.current;val api=remember(context){ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var options by remember{mutableStateOf<JsonObject?>(null)};var loading by remember{mutableStateOf(false)};var saving by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 var receivedFirst by rememberSaveable{mutableStateOf(true)}
 var key by rememberSaveable{mutableStateOf(UUID.randomUUID().toString())};var branch by rememberSaveable{mutableStateOf("")};var account by rememberSaveable{mutableStateOf("")};var date by rememberSaveable{mutableStateOf(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString())}
 var receivedParty by rememberSaveable{mutableStateOf("")};var paidParty by rememberSaveable{mutableStateOf("")};var received by rememberSaveable{mutableStateOf("")};var paid by rememberSaveable{mutableStateOf("")};var notes by rememberSaveable{mutableStateOf("")};var photoUri by rememberSaveable{mutableStateOf<String?>(null)}
 var pending by rememberSaveable{mutableStateOf<String?>(null)};var pendingSaveNew by rememberSaveable{mutableStateOf(false)}
 fun load(){if(loading||saving)return;loading=true;scope.launch{try{options=api.partyTransferOptions();if(branch.isBlank())branch=options?.array("branches")?.firstOrNull()?.jsonObject?.str("id").orEmpty()}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error="Transfer options could not be loaded. Reconnect and retry."}finally{loading=false}}}
 LaunchedEffect(Unit){load()}
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->if(uri!=null){runCatching{context.contentResolver.takePersistableUriPermission(uri,android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)};photoUri=uri.toString()}}
 fun save(saveNew:Boolean){if(saving)return
  val payload=try{pending?.let{Json.parseToJsonElement(it).jsonObject}?:partyTransferDocument(key,branch,account,date,receivedParty,paidParty,received,paid,notes)}catch(e:Exception){error=e.message?:"Review the transfer details.";return}
  if(pending==null){pending=payload.toString();pendingSaveNew=saveNew};saving=true;error=null
  scope.launch{var submitted=false;try{val photo=photoUri?.let{readTransferImageInput(context,android.net.Uri.parse(it))};submitted=true;val row=api.savePartyTransfer(payload,photo);pending=null
   if(pendingSaveNew){key=UUID.randomUUID().toString();receivedParty="";paidParty="";received="";paid="";notes="";photoUri=null}else navigate("/workspace/account/money/party-transfers/"+row.str("id"))
  }catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Result not confirmed. Retry the same request or view its saved result.";if(!submitted||e is IllegalArgumentException||(e is ApiException&&e.status==400))pending=null}finally{saving=false}}
 }
 val editable=!loading&&!saving&&pending==null&&options?.get("canPost")?.jsonPrimitive?.booleanOrNull==true
 val parties=options?.array("customers").orEmpty().filter{it.jsonObject.str("branchId")==branch}.map{val row=it.jsonObject;"CUSTOMER:"+row.str("id") to row.str("name")+" (Customer)"}+options?.array("vendors").orEmpty().map{val row=it.jsonObject;"VENDOR:"+row.str("id") to row.str("name")+" (Vendor)"}
 val valid=runCatching{partyTransferDocument(key,branch,account,date,receivedParty,paidParty,received,paid,notes)}.isSuccess
 val commission=runCatching{partyTransferCommission(received,paid)}.getOrDefault("0.00")
 LazyColumn(Modifier.padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Party To Party Transfer",style=MaterialTheme.typography.headlineSmall);TextButton(onBack,enabled=!saving){Text("Back")};TextButton({load()},enabled=!loading&&!saving){Text("Refresh options")}}
  if(loading||saving)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  error?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}}
  if(pending!=null)item{Button({save(pendingSaveNew)},enabled=!saving){Text("Retry same request")};TextButton({scope.launch{try{val row=api.partyTransfer(key);navigate("/workspace/account/money/party-transfers/"+row.str("id"))}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error="Saved result is not available yet. Retry the same request."}}},enabled=!saving){Text("View saved result")}}
  item{OutlinedTextField(date,{date=it},label={Text("Date (YYYY-MM-DD)")},enabled=editable)}
  item{ChequeSelect("Firm",branch,options?.array("branches").orEmpty().map{it.jsonObject.str("id") to it.jsonObject.str("name")},editable){branch=it;account="";receivedParty="";paidParty=""}}
  item{ChequeSelect("Cash / Bank",account,options?.array("accounts").orEmpty().filter{it.jsonObject.str("branchId").isBlank()||it.jsonObject.str("branchId")==branch}.map{it.jsonObject.str("id") to it.jsonObject.str("name")},editable){account=it}}
  for(direction in if(receivedFirst)listOf("received","paid")else listOf("paid","received"))item{
   Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){for(choice in listOf("received","paid"))FilterChip(selected=direction==choice,onClick={if(direction!=choice){receivedFirst=!receivedFirst;val old=receivedParty;receivedParty=paidParty;paidParty=old}},label={Text(if(choice=="received")"Received"else"Paid")},enabled=editable)}
   ChequeSelect(if(direction=="received")"Received from"else"Paid to",if(direction=="received")receivedParty else paidParty,parties,editable){if(direction=="received")receivedParty=it else paidParty=it}
   OutlinedTextField(if(direction=="received")received else paid,{if(direction=="received"){received=it;paid=it}else paid=it},label={Text(if(direction=="received")"Received amount"else"Paid amount")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),enabled=editable)
  }
  item{Text("Commission — Other Income: "+accountMoney(commission));OutlinedTextField(notes,{notes=it.take(5000)},label={Text("Add Note")},enabled=editable)}
  item{TextButton({picker.launch(arrayOf("image/jpeg","image/png","image/webp"))},enabled=editable){Text(if(photoUri==null)"Add image"else"Change image")};if(photoUri!=null)TextButton({photoUri=null},enabled=editable){Text("Remove image")}}
  item{Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton({save(true)},enabled=editable&&valid){Text("Save & New")};Button({save(false)},enabled=editable&&valid){Text("Save")}}}
 }
}
