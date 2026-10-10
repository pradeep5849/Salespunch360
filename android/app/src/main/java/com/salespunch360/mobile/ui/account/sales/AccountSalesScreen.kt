package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountSalesViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSalesScreen(initialType: String?, padding: PaddingValues, navigate:(String)->Unit={}, initialProjectId:String?=null, projectMode:Boolean=false, vm: AccountSalesViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialType) { if (initialType != null) vm.filter(initialType) }
    var initialEditorOpened by remember(initialType, initialProjectId, projectMode) { mutableStateOf(false) }
    LaunchedEffect(initialType, initialProjectId, projectMode, state.loading) {
        if (!initialEditorOpened && initialType == "SALES_INVOICE" && !state.loading && state.options.types.isNotEmpty()) {
            initialEditorOpened = true
            vm.newDocument(initialType, initialProjectId, projectMode)
        }
    }
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(state.query, vm::search, label = { Text("Search number or customer") }, singleLine = true, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            FilledIconButton(onClick = { vm.newDocument(initialType ?: state.options.types.firstOrNull().orEmpty()) }, enabled = state.options.types.isNotEmpty()) { Icon(Icons.Default.Add, "New document") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { FilterChip(state.typeFilter == null, { vm.filter(null) }, { Text("All") }) }
            items(state.options.types) { type -> FilterChip(state.typeFilter == type, { vm.filter(type) }, { Text(type.replace('_', ' ')) }) }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { error -> Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) { Row(Modifier.padding(12.dp)) { Text(error, Modifier.weight(1f)); TextButton(onClick = vm::refresh) { Text("Retry") } } } }
        state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(8.dp)) }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (!state.loading && state.rows.isEmpty()) item { Text("No sales documents found.", Modifier.padding(24.dp)) }
            items(state.rows, key = { it.id }) { row ->
                val isSale=row.type=="SALES_INVOICE"
                val paymentLabel=when(row.paymentStatus){"PAID"->"SALE : PAID";"PARTIALLY_PAID"->"SALE : PARTIAL";"UNPAID"->"SALE : UNPAID";else->row.status}
                ElevatedCard(Modifier.fillMaxWidth().clickable { vm.open(row.id) }) {
                    Column {
                        Row(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=11.dp),horizontalArrangement=Arrangement.SpaceBetween){
                            Column(Modifier.weight(1f)){Text(row.party,fontWeight=FontWeight.SemiBold);Text(if(isSale)paymentLabel else row.type.replace('_',' '),style=MaterialTheme.typography.labelSmall,color=if(row.paymentStatus=="PAID")MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)}
                            Column{Text("#${row.number}",fontWeight=FontWeight.Medium,style=MaterialTheme.typography.bodySmall);Text(row.date,style=MaterialTheme.typography.labelSmall)}
                        }
                        Row(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=8.dp)){Column(Modifier.weight(1f)){Text("Total",style=MaterialTheme.typography.labelSmall);Text("₹${row.total}",fontWeight=FontWeight.SemiBold)};Column(Modifier.weight(1f)){Text("Balance",style=MaterialTheme.typography.labelSmall);Text("₹${row.balance.ifBlank{row.total}}",fontWeight=FontWeight.SemiBold)};IconButton(onClick={vm.open(row.id)}){Icon(Icons.Default.Print,"Print")};IconButton(onClick={vm.open(row.id)}){Icon(Icons.Default.Share,"Share")};IconButton(onClick={vm.open(row.id)}){Icon(Icons.Default.MoreVert,"More")}}
                    }
                }
            }
        }
    }
    state.editor?.let { SalesDocumentEditor(it, state.options, state.saving, vm::editDraft, vm::addLine, vm::updateLine, vm::removeLine, vm::closeEditor, vm::save,vm::updateInvoicePrefix,vm::createSaleCustomer,navigate) }
    state.detail?.let { SalesDocumentDetail(it, state.saving, vm::closeDetail, vm::requestPost, vm::editSavedSale, vm::deleteSavedSale) }
    state.postingId?.let { AlertDialog(onDismissRequest = vm::cancelPost,title = { Text("Post document?") },text = { Text("Posting is authoritative and may create ledger and stock movements. This requires server confirmation.") },confirmButton = { Button(onClick = vm::confirmPost) { Text("Post") } },dismissButton = { TextButton(onClick = vm::cancelPost) { Text("Cancel") } }) }
}
