package com.salespunch360.mobile.ui.account.money

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.ui.account.accountMoney
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import com.salespunch360.mobile.ui.account.accountDate
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive

@Composable
fun PartyTransferDetailScreen(id:String,padding:PaddingValues,onBack:()->Unit,canReverse:Boolean=false){
 val context=LocalContext.current
 val api=remember(context){ApiClient(SecureSession(context))}
 val scope=rememberCoroutineScope()
 var data by remember(id){mutableStateOf<JsonObject?>(null)}
 var loading by remember(id){mutableStateOf(false)}
 var error by remember(id){mutableStateOf<String?>(null)}
 var reason by rememberSaveable(id){mutableStateOf("")}
 var reversalDate by rememberSaveable(id){mutableStateOf(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString())}
 var pending by rememberSaveable(id){mutableStateOf<String?>(null)}
 var image by remember(id){mutableStateOf<android.graphics.Bitmap?>(null)}
 fun load(){if(loading)return;loading=true;error=null;scope.launch{try{data=api.partyTransfer(id)}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Transfer could not be loaded. Reconnect and retry."}finally{loading=false}}}
 LaunchedEffect(id){load()}
 LazyColumn(Modifier.padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Party To Party Transfer",style=MaterialTheme.typography.headlineSmall);TextButton(onBack){Text("Back")};TextButton({load()},enabled=!loading){Text("Refresh")}}
  if(loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  error?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}}
  data?.let{row->
   item{Text(row.str("number"),style=MaterialTheme.typography.titleMedium);Text("Status: "+row.str("status"));Text("Date: "+accountDate(row.str("transactionDate")))}
   item{Text("Received from: "+row.str("receivedPartyName"));Text("Received: "+accountMoney(row.str("receivedAmount")))}
   item{Text("Paid to: "+row.str("paidPartyName"));Text("Paid: "+accountMoney(row.str("paidAmount")))}
   item{Text("Pass-through: "+accountMoney(row.str("passThroughAmount")));Text("Commission — Other Income: "+accountMoney(row.str("commissionAmount")));if(row.str("notes").isNotBlank())Text(row.str("notes"))}
   if(canReverse&&row.str("status")=="POSTED")item{
    Text("Reverse entire transfer",style=MaterialTheme.typography.titleMedium);Text("Both cash movements and commission are reversed. Original history is retained.")
    OutlinedTextField(reversalDate,{reversalDate=it},label={Text("Reversal date (YYYY-MM-DD)")},enabled=!loading&&pending==null)
    OutlinedTextField(reason,{reason=it.take(1000)},label={Text("Reversal reason")},enabled=!loading&&pending==null)
    Button({if(!loading){val request=pending?.let{Json.parseToJsonElement(it).jsonObject}?:buildJsonObject{put("requestKey",java.util.UUID.randomUUID().toString());put("entryDate",reversalDate);put("reason",reason)};pending=request.toString();loading=true;error=null;scope.launch{try{api.reversePartyTransfer(id,request);data=api.partyTransfer(id);pending=null}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Reversal not confirmed. Retry the same request.";if(e is ApiException&&e.status==400)pending=null}finally{loading=false}}}},enabled=!loading&&reason.trim().length>=3){Text(if(pending==null)"Reverse transfer"else"Retry same reversal")}
   }
   if(row["hasPhoto"]?.jsonPrimitive?.booleanOrNull==true)item{TextButton({if(!loading){loading=true;scope.launch{try{val bytes=api.partyTransferPhoto(id);image=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)?:throw IllegalArgumentException("Invalid image")}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){error="The private image could not be loaded or verified."}finally{loading=false}}}},enabled=!loading){Text("View image")}}
  }
  image?.let{bitmap->item{Image(bitmap.asImageBitmap(),contentDescription="Saved party transfer image",modifier=Modifier.fillMaxWidth())}}
 }
}
