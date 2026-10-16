package com.salespunch360.mobile.ui.account.money
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.ChequeViewModel
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.ui.account.accountDate
import com.salespunch360.mobile.ui.account.accountMoney
import java.util.UUID
import kotlinx.serialization.json.*

@Composable fun ChequeScreen(padding:PaddingValues,initialQuery:String="",onNavigate:(String)->Unit={},vm:ChequeViewModel=viewModel()) {
 LaunchedEffect(initialQuery){vm.context(initialQuery)}
 var selected by remember { mutableStateOf<JsonObject?>(null) }
 var entryOpen by remember { mutableStateOf(false) }
 var legacyEntry by remember { mutableStateOf<JsonObject?>(null) }
 var selectedAction by remember { mutableStateOf("CLOSE") }
 val state=vm.state.collectAsStateWithLifecycle().value
 Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("OPEN","CLOSED","ALL").forEach{tab->FilterChip(state.tab==tab,{vm.tab(tab)},{Text(tab.lowercase().replaceFirstChar{it.uppercase()})})}}
  OutlinedTextField(state.q,vm::search,label={Text("Search cheques")},modifier=Modifier.fillMaxWidth())
  Row { TextButton(vm::sort){Text(if(state.order=="desc")"Date ↓"else"Date ↑")};TextButton(vm::refresh){Text("Refresh")}}
  if(state.canClose)TextButton({vm.entryOptions();legacyEntry=null;entryOpen=true},enabled=!state.saving){Text("Record cheque")}
  if(state.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  state.error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(vm::refresh){Text("Retry")}}
  if(!state.loading&&state.error==null&&state.rows.isEmpty())Text(if(state.q.isBlank())if(state.tab=="ALL")"No cheques."else"No ${state.tab.lowercase()} cheques."else"No cheques match this search.")
  LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
   items(state.rows,key={it.str("id")}) {row->
    Card(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp)) {
     Text(row.str("partyName"),style=MaterialTheme.typography.titleMedium)
     Text("Cheque ${row.str("chequeNumber")} · ${row.str("status")}")
     Text("Amount: ${row["amount"]?.jsonPrimitive?.contentOrNull?.let{accountMoney(it)} ?: "Not recorded"}")
     Text("Date: ${accountDate(row.str("chequeDate"))}")
     Text("Bank: ${(row["moneyAccount"] as? JsonObject)?.str("name") ?: "Account unavailable"}")
     val transaction=row["sourceTransaction"] as? JsonObject
     if(transaction!=null&&transaction.str("nativeHref").isNotBlank())TextButton({onNavigate(transaction.str("nativeHref"))}){Text("View Txn")}
     else (row["sourceDocument"] as? JsonObject)?.let{source->TextButton({onNavigate(if(source.str("type")=="SALES_INVOICE")"/workspace/account/sales/${source.str("id")}"else"/workspace/account/purchases/${source.str("id")}")}){Text("View Txn")}}
     if(row["settlementId"]?.jsonPrimitive?.contentOrNull!=null){
      Row{if(state.canClose&&row.str("status") in listOf("ISSUED","RECEIVED"))TextButton({vm.entryOptions(row.str("branchId"),"ALL");selected=row;selectedAction="CLOSE"},enabled=!state.saving){Text("Close cheque")}
       if(state.canCorrect&&row.str("status") in listOf("CLEARED","DEPOSITED","BOUNCED"))TextButton({selected=row;selectedAction="REOPEN"},enabled=!state.saving){Text("Re-open")}}
      if(state.canCorrect&&row.str("status") !in listOf("BOUNCED","CANCELLED"))Row{TextButton({selected=row;selectedAction="BOUNCE"},enabled=!state.saving){Text("Bounced")};TextButton({selected=row;selectedAction="CANCEL"},enabled=!state.saving){Text("Cancel cheque")}}
     }else{Text("Link the original payment source before financial actions.");if(state.canClose&&row["journalEntryId"]?.jsonPrimitive?.contentOrNull==null&&row["clearedDate"]?.jsonPrimitive?.contentOrNull==null&&row.str("status") in listOf("ISSUED","RECEIVED"))TextButton({vm.clearEntryOptions();legacyEntry=row;entryOpen=true},enabled=!state.saving){Text("Complete source details")}}
     row["clearedDate"]?.jsonPrimitive?.contentOrNull?.let{Text("Closure date: ${accountDate(it)}")}
     row.str("closureDescription").takeIf{it.isNotBlank()}?.let{Text("Description: $it")}
     row.str("reference").takeIf{it.isNotBlank()}?.let{Text("Reference: $it")}
    }}
   }
   item { Row { Text("${state.rows.size} of ${state.total} cheques");if(state.nextOffset!=null)TextButton(vm::more,enabled=!state.loading){Text("Load more")}} }
  }
 }

 if(entryOpen)key(legacyEntry?.str("id")){ChequeEntryDialog(state,vm,legacyEntry,close={entryOpen=false;legacyEntry=null},addAccount={entryOpen=false;legacyEntry=null;onNavigate("/workspace/account/money/accounts")})}
 selected?.let{row->key(row.str("id"),selectedAction){
  var date by remember{mutableStateOf("")};var reason by remember{mutableStateOf("")};var destination by remember{mutableStateOf("")};var description by remember{mutableStateOf("")};var accountOffset by remember{mutableIntStateOf(0)};val requestKey=remember{UUID.randomUUID().toString()}
  val actionTitle=when(selectedAction){"CLOSE"->"Close cheque";"REOPEN"->"Re-open cheque";"BOUNCE"->"Record bounced cheque";else->"Cancel cheque"}
  AlertDialog(onDismissRequest={if(!state.saving)selected=null},title={Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(actionTitle,modifier=Modifier.weight(1f));if(selectedAction=="REOPEN")TextButton({selected=null},enabled=!state.saving){Text("Close")}}},text={Column{
   Text(if(selectedAction=="CLOSE")"Confirm closure to post payment to the selected account and settle the invoice."else"This reverses the closure payment and restores the invoice's unpaid balance.")
   if(selectedAction=="CLOSE"){
    if(state.optionsLoading)LinearProgressIndicator()
    OutlinedTextField(description,{description=it.take(500)},label={Text("Description")},enabled=!state.saving)
    ChequeSelect("Payment account",destination,state.entryOptions.array("accounts").map{it.jsonObject}.map{it.str("id") to it.str("name")},!state.saving&&!state.optionsLoading){destination=it}
    if(accountOffset>0)TextButton({accountOffset=(accountOffset-25).coerceAtLeast(0);destination="";vm.entryOptions(row.str("branchId"),"ALL",accountOffset)},enabled=!state.optionsLoading&&!state.saving){Text("Previous accounts")}
    if(state.entryOptions["hasMore"]?.jsonPrimitive?.booleanOrNull==true)TextButton({accountOffset+=25;destination="";vm.entryOptions(row.str("branchId"),"ALL",accountOffset)},enabled=!state.optionsLoading&&!state.saving){Text("More accounts")}
   }
   OutlinedTextField(date,{date=it},label={Text("Action date (YYYY-MM-DD)")},singleLine=true,enabled=!state.saving)
   if(selectedAction!="CLOSE")OutlinedTextField(reason,{reason=it.take(500)},label={Text("Reason")},enabled=!state.saving)
   state.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
  }},confirmButton={TextButton({vm.action(row,selectedAction,date,reason,requestKey,destination.takeIf{selectedAction=="CLOSE"},description){selected=null}},enabled=!state.saving&&date.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))&&(if(selectedAction=="CLOSE")destination.isNotBlank()&&!state.optionsLoading else reason.isNotBlank())){Text(if(state.saving)"Saving…"else if(selectedAction=="REOPEN")"Yes"else"Confirm")}},dismissButton={TextButton({selected=null},enabled=!state.saving){Text("Cancel")}})
 }}
}
