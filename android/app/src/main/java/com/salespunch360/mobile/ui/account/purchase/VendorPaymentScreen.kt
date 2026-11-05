package com.salespunch360.mobile.ui.account.purchase
import com.salespunch360.mobile.ui.account.accountDate

import com.salespunch360.mobile.ui.account.accountMoney
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.VendorPaymentViewModel
import com.salespunch360.mobile.ui.account.sales.SelectField

@Composable
fun VendorPaymentScreen(padding: PaddingValues, initialBranchId:String?=null, vm: VendorPaymentViewModel = viewModel()) {
    var preview by remember{mutableStateOf<com.salespunch360.mobile.VendorPaymentRow?>(null)}
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(state.loading,initialBranchId){if(!state.loading)vm.initialBranch(initialBranchId)}
    val bills = state.bills.filter { it.branchId == state.branchId && it.vendorId == state.vendorId }
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Text("Payment-Out / Vendor Payment", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        item { SelectField("Branch", state.branchId, state.branches.map { it.id to it.name }) { id -> vm.update { it.copy(branchId = id, vendorId = "", billId = "") } } }
        item { SelectField("Vendor", state.vendorId, state.vendors.map { it.id to it.name }) { id -> vm.update { it.copy(vendorId = id, billId = "") } } }
        item { SelectField("Payment type",state.type,state.allowedTypes.map{it to it.replace('_',' ')}){value->vm.update{it.copy(type=value,billId="",openingId="",linkAmount="")}} }
        if(state.type!="VENDOR_ADVANCE")item { SelectField("Purchase bill", state.billId, bills.map { it.id to "${it.number} · Outstanding ${accountMoney(it.outstanding)}" }) { id -> val bill = bills.first { it.id == id }; vm.update { it.copy(billId = id, openingId="", amount = bill.outstanding,linkAmount=bill.outstanding) } } }
        if(state.type!="VENDOR_ADVANCE")item{SelectField("Opening balance",state.openingId,state.openings.filter{it.branchId==state.branchId&&it.vendorId==state.vendorId}.map{it.id to "${it.date} · ${accountMoney(it.outstanding)}"}){id->val opening=state.openings.first{it.id==id};vm.update{it.copy(openingId=id,billId="",amount=opening.outstanding,linkAmount=opening.outstanding)}}}
        if(state.type!="VENDOR_ADVANCE")item{OutlinedTextField(state.linkAmount,{value->vm.update{it.copy(linkAmount=value)}},label={Text("Link amount")})}
        item { OutlinedTextField(state.amount, { value -> vm.update { it.copy(amount = value) } }, label = { Text("Amount") }) }
        item { OutlinedTextField(state.date, { value -> vm.update { it.copy(date = value) } }, label = { Text("Payment date") }) }
        item { SelectField("Method", state.mode, listOf("CASH" to "Cash", "BANK" to "Bank")) { value -> vm.update { it.copy(mode = value) } } }
        item { SelectField("Money account", state.accountId, state.accounts.filter { it.branchId == null || it.branchId == state.branchId }.map { it.id to it.name }) { value -> vm.update { it.copy(accountId = value) } } }
        item { OutlinedTextField(state.reference, { value -> vm.update { it.copy(reference = value) } }, label = { Text("Reference") }) }
        item { OutlinedTextField(state.notes, { value -> vm.update { it.copy(notes = value) } }, label = { Text("Notes") }) }
        item { Button(onClick = vm::save, enabled = !state.saving && !state.loading && state.type in state.allowedTypes && (state.type=="VENDOR_ADVANCE" || state.billId.isNotBlank() || state.openingId.isNotBlank()), modifier = Modifier.fillMaxWidth()) { Text(if (state.saving) "Posting…" else "Post payment") } }
        item { Text("Recent payments", style = MaterialTheme.typography.titleLarge) }
        items(state.history, key = { it.id }) { row ->
            ListItem(headlineContent = { Text(row.number) }, supportingContent = { Text("${accountDate(row.date)} · ${row.mode}") }, trailingContent = { Column { Text(accountMoney(row.amount)); TextButton(onClick={preview=row}){Text("Preview / Share")} } })
        }
    }
    preview?.let{row->AlertDialog(onDismissRequest={preview=null},title={Text(row.number)},text={Column{com.salespunch360.mobile.ui.account.DocumentPrintActions(row.type,row.id,row.number)}},confirmButton={TextButton(onClick={preview=null}){Text("Close")}})}
}
