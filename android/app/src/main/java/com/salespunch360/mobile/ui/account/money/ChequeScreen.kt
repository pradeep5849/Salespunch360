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
import kotlinx.serialization.json.*

@Composable fun ChequeScreen(padding:PaddingValues,initialQuery:String="",vm:ChequeViewModel=viewModel()) {
 LaunchedEffect(initialQuery){vm.context(initialQuery)}
 val state=vm.state.collectAsStateWithLifecycle().value
 Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("OPEN","CLOSED","ALL").forEach{tab->FilterChip(state.tab==tab,{vm.tab(tab)},{Text(tab.lowercase().replaceFirstChar{it.uppercase()})})}}
  OutlinedTextField(state.q,vm::search,label={Text("Search cheques")},modifier=Modifier.fillMaxWidth())
  Row { TextButton(vm::sort){Text(if(state.order=="desc")"Date ↓"else"Date ↑")};TextButton(vm::refresh){Text("Refresh")}}
  if(state.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  state.error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(vm::refresh){Text("Retry")}}
  if(!state.loading&&state.error==null&&state.rows.isEmpty())Text(if(state.q.isBlank())if(state.tab=="ALL")"No cheques."else"No ${state.tab.lowercase()} cheques."else"No cheques match this search.")
  LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
   items(state.rows,key={it.str("id")}) {row->
    Card(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp)) {
     Text(row.str("partyName"),style=MaterialTheme.typography.titleMedium)
     Text("Cheque ${row.str("chequeNumber")} · ${row.str("status")}")
     Text("Date: ${accountDate(row.str("chequeDate"))}")
     Text("Bank: ${(row["moneyAccount"] as? JsonObject)?.str("name") ?: "Account unavailable"}")
     row.str("reference").takeIf{it.isNotBlank()}?.let{Text("Reference: $it")}
    }}
   }
   item { Row { Text("${state.rows.size} of ${state.total} cheques");if(state.nextOffset!=null)TextButton(vm::more,enabled=!state.loading){Text("Load more")}} }
  }
 }
}
