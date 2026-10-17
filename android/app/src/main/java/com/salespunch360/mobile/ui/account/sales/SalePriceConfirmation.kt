package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.ui.account.accountMoney
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

@Composable
fun SalePriceConfirmation(documentId:String,onFinished:()->Unit){
 val context=LocalContext.current
 val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var rows by remember(documentId){mutableStateOf<List<JsonObject>>(emptyList())}
 var loading by remember{mutableStateOf(true)};var saving by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 val keys=remember(documentId){mutableMapOf<String,String>()}
 suspend fun load(){loading=true;error=null;try{rows=api.salePriceProposals(documentId).map{it.jsonObject};keys.clear();if(rows.isEmpty())onFinished()}catch(e:CancellationException){throw e}catch(e:Exception){error="Invoice saved. Price choices could not be loaded. Retry or keep saved prices."}finally{loading=false}}
 LaunchedEffect(documentId){load()}
 AlertDialog(onDismissRequest={if(!saving)onFinished()},title={Text("Invoice saved")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Update saved retail prices for future sales? Prices exclude tax and are before discounts. This invoice and its payments will stay unchanged.")
  if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  rows.forEach{row->Card{Column(Modifier.padding(12.dp)){
   Text(row.str("name"));Text("${accountMoney(row.str("oldPrice"))} → ${accountMoney(row.str("newPrice"))}")
   Button(enabled=!saving&&!loading,onClick={scope.launch{saving=true;error=null;try{val key=keys.getOrPut(row.str("lineId")){java.util.UUID.randomUUID().toString()};api.confirmSalePrice(documentId,buildJsonObject{put("lineId",row.str("lineId"));put("expectedUpdatedAt",row.str("expectedUpdatedAt"));put("requestKey",key);put("confirmed",true)});rows=rows.filter{it.str("sourceKey")!=row.str("sourceKey")};if(rows.isEmpty())onFinished()}catch(e:CancellationException){throw e}catch(e:Exception){error="Invoice saved. Price update was not confirmed. Retry the update or refresh the price choices."}finally{saving=false}}}){Text("Update retail price for ${row.str("name")}")}
  }}}
  error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(enabled=!saving&&!loading,onClick={scope.launch{load()}}){Text("Refresh price choices")}}
 }},confirmButton={TextButton(enabled=!saving,onClick=onFinished){Text("Keep remaining saved prices")}})
}
