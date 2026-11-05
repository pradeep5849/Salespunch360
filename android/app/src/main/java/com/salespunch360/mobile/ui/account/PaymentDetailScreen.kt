package com.salespunch360.mobile.ui.account
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import kotlinx.serialization.json.*
@Composable fun PaymentDetailScreen(id:String,padding:PaddingValues,navigate:(String)->Unit,onClose:()->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};var data by remember(id){mutableStateOf<JsonObject?>(null)};var error by remember(id){mutableStateOf<String?>(null)};var retry by remember{mutableStateOf(0)}
 LaunchedEffect(id,retry){data=null;error=null;try{data=api.accountSettlement(id)}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Could not load this authorized payment."}}
 Column(Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
  TextButton(onClick=onClose){Text("Back")}
  error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(onClick={retry++}){Text("Retry")}}
  if(data==null&&error==null)LinearProgressIndicator(Modifier.fillMaxWidth())
  data?.let{root->val entry=root["entry"]!!.jsonObject
   Text(if(entry.str("type").startsWith("CUSTOMER"))"Payment-In"else"Payment-Out",style=MaterialTheme.typography.headlineSmall)
   Text(entry.str("documentNumber"));Text(entry.str("partyName"));Text("${accountDate(entry.str("issueDate"))} · ${entry.str("status")}");Text("Branch: ${root.str("branch")}")
   Text("Amount: ${accountMoney(entry.str("grandTotal"))}");Text("Unused: ${accountMoney(entry.str("balanceDue"))}");Text("Discount: ${accountMoney(root.str("discountAmount"))}");Text("Method: ${root.str("paymentMode")}")
   root.str("reference").takeIf{it.isNotBlank()}?.let{Text("Reference: $it")};root.str("notes").takeIf{it.isNotBlank()}?.let{Text(it)}
   Text("Applications",style=MaterialTheme.typography.titleMedium)
   val applications=root.array("applications");if(applications.isEmpty())Text("No applications.")
   applications.forEach{row->Text("${row.str("number")} · ${row.str("status")} · ${accountMoney(row.str("amount"))}");row.str("href").takeIf{it.isNotBlank()&&it!="null"}?.let{href->TextButton(onClick={navigate(href)}){Text("Open linked document")}}}
   DocumentPrintActions(entry.str("printType"),id,entry.str("documentNumber"))
   if(root.bool("canDuplicate"))TextButton(onClick={navigate("/workspace/account/transactions/money?type=${entry.str("type")}&duplicateId=$id")}){Text("Duplicate payment")}
   Text("Opening, printing or preparing a duplicate does not post money. A duplicate is an unlinked new entry until you save it.")
  }
 }
}
