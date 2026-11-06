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
fun VendorPaymentScreen(padding: PaddingValues,duplicateId:String?=null, initialBranchId:String?=null, vm: VendorPaymentViewModel = viewModel()) {
    var preview by remember{mutableStateOf<com.salespunch360.mobile.VendorPaymentRow?>(null)}
    val state = vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(state.loading,initialBranchId){if(!state.loading)vm.initialBranch(initialBranchId)}
    LaunchedEffect(duplicateId,state.loading){vm.duplicate(duplicateId)}
    val bills = state.bills.filter { it.branchId == state.branchId && it.vendorId == state.vendorId }
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Text("Payment-Out / Vendor Payment", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        item { SelectField("Branch", state.branchId, state.branches.map { it.id to it.name }) { id -> vm.edit { it.copy(branchId = id, vendorId = "", billId = "") } } }
        item { SelectField("Vendor", state.vendorId, state.vendors.map { it.id to it.name }) { id -> vm.edit { it.copy(vendorId = id, billId = "") } } }
        item { SelectField("Payment type",state.type,state.allowedTypes.map{it to it.replace('_',' ')}){value->vm.edit{it.copy(type=value,billId="",openingId="",linkAmount="")}} }
        if(state.type=="VENDOR_PAYMENT")item{Row{Checkbox(state.multipleLinks,{value->vm.edit{it.copy(multipleLinks=value,links=emptyMap())}});Text("Link multiple bills / keep unused advance")}}
        if(state.type=="VENDOR_PAYMENT"&&state.multipleLinks){items(bills,key={"link-${it.id}"}){bill->OutlinedTextField(state.links[bill.id].orEmpty(),{value->vm.edit{it.copy(links=it.links+(bill.id to value))}},label={Text("${bill.number} · balance ${accountMoney(bill.outstanding)}")})};item{val total=state.links.values.mapNotNull{it.toBigDecimalOrNull()}.fold(java.math.BigDecimal.ZERO){sum,value->sum+value};Text("Unused advance: ${accountMoney(((state.amount.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO)-total).toPlainString())}")}}
        if(state.type!="VENDOR_ADVANCE"&&!state.multipleLinks)item { SelectField("Purchase bill", state.billId, bills.map { it.id to "${it.number} · Outstanding ${accountMoney(it.outstanding)}" }) { id -> val bill = bills.first { it.id == id }; vm.edit { it.copy(billId = id, openingId="", amount = bill.outstanding,linkAmount=bill.outstanding) } } }
        if(state.type!="VENDOR_ADVANCE"&&!state.multipleLinks)item{SelectField("Opening balance",state.openingId,state.openings.filter{it.branchId==state.branchId&&it.vendorId==state.vendorId}.map{it.id to "${it.date} · ${accountMoney(it.outstanding)}"}){id->val opening=state.openings.first{it.id==id};vm.edit{it.copy(openingId=id,billId="",amount=opening.outstanding,linkAmount=opening.outstanding)}}}
        if(state.type!="VENDOR_ADVANCE"&&!state.multipleLinks)item{OutlinedTextField(state.linkAmount,{value->vm.edit{it.copy(linkAmount=value)}},label={Text("Link amount")})}
        item { OutlinedTextField(state.amount, { value -> vm.edit { it.copy(amount = value) } }, label = { Text("Amount") }) }
        item { OutlinedTextField(state.date, { value -> vm.edit { it.copy(date = value) } }, label = { Text("Payment date") }) }
        item { SelectField("Method", state.mode, listOf("CASH" to "Cash", "BANK" to "Bank", "CHEQUE" to "Cheque")) { value -> vm.edit { it.copy(mode = value) } } }
        if(state.mode=="CHEQUE"){
            item{OutlinedTextField(state.chequeNumber,{value->vm.edit{it.copy(chequeNumber=value)}},label={Text("Cheque number")})}
            item{OutlinedTextField(state.chequeDate,{value->vm.edit{it.copy(chequeDate=value)}},label={Text("Cheque date")})}
            item{Text("Pending until cleared. Linked amounts and cash are posted together at clearance.")}
        }
        item { SelectField("Money account", state.accountId, state.accounts.filter { it.branchId == null || it.branchId == state.branchId }.map { it.id to it.name }) { value -> vm.edit { it.copy(accountId = value) } } }
        if(state.type!="APPLY_ADVANCE"){
            item{OutlinedTextField(state.billingName,{value->vm.edit{it.copy(billingName=value)}},label={Text("Billing name (optional)")})}
            item{OutlinedTextField(state.billingAddress,{value->vm.edit{it.copy(billingAddress=value)}},label={Text("Billing address (optional)")})}
            item{com.salespunch360.mobile.ui.account.PaymentEvidencePicker(state.evidenceFiles,!state.saving&&!state.loading){files->vm.edit{it.copy(evidenceFiles=files)}}}
        }
        item { OutlinedTextField(state.reference, { value -> vm.edit { it.copy(reference = value) } }, label = { Text("Reference") }) }
        item { OutlinedTextField(state.notes, { value -> vm.edit { it.copy(notes = value) } }, label = { Text("Notes") }) }
        item { Button(onClick = vm::save, enabled = !state.saving && !state.loading && state.type in state.allowedTypes && (state.type=="VENDOR_ADVANCE" || state.multipleLinks || state.billId.isNotBlank() || state.openingId.isNotBlank()), modifier = Modifier.fillMaxWidth()) { Text(if (state.saving) "Posting…" else "Post payment") } }
        item { Text("Recent payments", style = MaterialTheme.typography.titleLarge) }
        items(state.history, key = { it.id }) { row ->
            ListItem(headlineContent = { Text(row.number) }, supportingContent = { Text("${accountDate(row.date)} · ${row.mode}") }, trailingContent = { Column { Text(accountMoney(row.amount)); TextButton(onClick={preview=row}){Text("Preview / Share")} } })
        }
    }
    preview?.let{row->AlertDialog(onDismissRequest={preview=null},title={Text(row.number)},text={Column{com.salespunch360.mobile.ui.account.DocumentPrintActions(row.type,row.id,row.number)}},confirmButton={TextButton(onClick={preview=null}){Text("Close")}})}
}
