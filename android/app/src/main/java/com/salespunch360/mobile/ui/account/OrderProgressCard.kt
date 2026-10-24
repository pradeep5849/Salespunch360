package com.salespunch360.mobile.ui.account

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.bool
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

@Composable
fun OrderProgressCard(id:String,navigate:(String)->Unit={}){
 val context=LocalContext.current
 val api=remember(context){ApiClient(SecureSession(context))}
 val scope=rememberCoroutineScope()
 var state by remember(id){mutableStateOf<JsonObject?>(null)}
 var loading by remember(id){mutableStateOf(false)}
 var error by remember(id){mutableStateOf<String?>(null)}
 var reason by remember(id){mutableStateOf("")}
 var retry by remember(id){mutableIntStateOf(0)}
 LaunchedEffect(id,retry){loading=true;error=null;try{state=api.accountOrderState(id)}catch(e:CancellationException){throw e}catch(_:Exception){error="Order quantities could not be loaded. Try again."}finally{loading=false}}
 OutlinedCard(Modifier.fillMaxWidth().padding(12.dp)){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
  Text("Order fulfilment",style=MaterialTheme.typography.titleMedium)
  if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(onClick={retry++},enabled=!loading){Text("Reload order")}}
  state?.let{current->
   Text("Status: ${current.str("status")} · ${current.str("reason").replace('_',' ')}")
   current.str("note").takeIf{it.isNotBlank()}?.let{Text(it)}
   current.array("lines").forEach{line->Text("${line.str("itemName")}: Ordered ${line.str("ordered")} · Invoiced / billed ${line.str("fulfilled")} · Remaining ${line.str("remaining")}")}
   if(current.str("type")=="SALES_ORDER"&&current.str("status")=="OPEN"&&current.bool("canPrepareSale"))TextButton(enabled=!loading,onClick={navigate("/workspace/account/transactions/new?type=SALES_INVOICE&orderId=$id")}){Text("Create Sale from remaining order")}
   if(current.str("type")=="PURCHASE_ORDER"&&current.str("status")=="OPEN"&&current.bool("canPreparePurchase"))TextButton(enabled=!loading,onClick={navigate("/workspace/account/transactions/new?type=PURCHASE_BILL&orderId=$id")}){Text("Create Bill from remaining order")}
   if(current.bool("canClose")&&current.str("status")!="CLOSED"){
    OutlinedTextField(reason,{if(it.length<=1000)reason=it},label={Text("Reason for closing remaining order")},enabled=!loading,modifier=Modifier.fillMaxWidth())
    Text("Closes the remaining commitment. No invoice, payment or journal is created.")
    Button(enabled=!loading&&reason.isNotBlank(),onClick={loading=true;error=null;scope.launch{try{state=api.closeAccountOrder(id,reason.trim());reason=""}catch(e:CancellationException){throw e}catch(_:Exception){error="Order could not be closed. Reload its status before trying again."}finally{loading=false}}}){Text("Close remaining order")}
   }
  }
 }}
}
