package com.salespunch360.mobile.ui.account.purchase
import com.salespunch360.mobile.ui.account.accountMoney
import com.salespunch360.mobile.ui.account.accountDate
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.salespunch360.mobile.account.bool
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.*
@Composable fun PurchaseDetail(d:JsonObject,saving:Boolean,onClose:()->Unit,onPost:(String)->Unit,navigate:(String)->Unit={},canDuplicate:Boolean=false,onDuplicate:()->Unit={}){
 Dialog(onDismissRequest=onClose,properties=DialogProperties(usePlatformDefaultWidth=false)){
  Surface(Modifier.fillMaxSize()){
   LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
    item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(d.str("documentNumber"),style=MaterialTheme.typography.titleLarge);TextButton(onClose){Text("Close")}};Text("${d.str("type").replace('_',' ')} · ${d.str("status")}",fontWeight=FontWeight.Bold);Text(d.str("partyName"));Text((d["branch"] as? JsonObject)?.str("name").orEmpty());Text("Date: ${accountDate(d.str("issueDate"))}")}
    item{if(d.str("type")=="PURCHASE_ORDER")com.salespunch360.mobile.ui.account.OrderProgressCard(d.str("id"),navigate)}
    item{listOf("billingName" to "Billing name","partyGstin" to "GSTIN","partyAddress" to "Party address","vendorInvoiceNumber" to "Supplier bill number","vendorInvoiceDate" to "Supplier bill date","postingDate" to "Accounting date","stateOfSupplyCode" to "State of supply","paymentTerms" to "Payment terms","grnReference" to "GRN / delivery reference","purchaseLocation" to "Location","purchasePurpose" to "Purchase purpose","materialTreatment" to "Material treatment").forEach{(key,label)->d.str(key).takeIf{it.isNotBlank()}?.let{Text("$label: $it")}}}
    items(d.array("lines")){line->Card{Column(Modifier.padding(12.dp)){Text(line.str("itemName"),fontWeight=FontWeight.Bold);Text("${line.str("quantity")} ${line.str("unitName")} × ${accountMoney(line.str("rate"))}");Text("Total ${accountMoney(line.str("lineTotal"))} · GST ${accountMoney(line.str("taxAmount"))}");line.str("description").takeIf{it.isNotBlank()}?.let{Text(it)}}}}
    item{HorizontalDivider();Text("Grand total ${accountMoney(d.str("grandTotal"))}",fontWeight=FontWeight.Bold);Text("Tax ${accountMoney(d.str("taxTotal"))} · Payable ${accountMoney(d.str("payableAmount"))}");(d["financial"] as? JsonObject)?.let{Text("Current balance ${accountMoney(it.str("outstanding"))}")}}
    item{Text("Payments and applications",style=MaterialTheme.typography.titleMedium)}
    items(d.array("allocations")){row->val payment=row["settlement"] as? JsonObject;Text("${payment?.str("settlementNumber").orEmpty()} · ${payment?.str("paymentMode").orEmpty()} · ${accountMoney(row.str("amount"))}")}
    items(d.array("advanceApplications")){row->Text("Advance applied: ${accountMoney(row.str("amount"))}")}
    item{Text("Inventory and project history",style=MaterialTheme.typography.titleMedium)}
    items(d.array("stockMovements")){row->Text("${accountDate(row.str("movementDate"))} · ${row.str("movementType")} · ${row.str("quantity")}")}
    items(d.array("projectMaterialMovements")){row->Text("${row.str("movementType")} · ${row.str("quantity")}")}
    item{com.salespunch360.mobile.ui.account.DocumentPrintActions(d.str("type"),d.str("id"),d.str("documentNumber"))}
    item{d.str("notes").takeIf{it.isNotBlank()}?.let{Text(it)};TextButton(onClick={navigate("/workspace/account/settings/transactions")}){Text("Transaction settings")}}
    item{if(d.str("type")=="PURCHASE_BILL"&&canDuplicate)Button(enabled=!saving,onClick=onDuplicate){Text("Duplicate purchase")};if(d.str("status")=="POSTED")Text("Posted bills retain their journals, payments and stock history. Correct them through a purchase return/debit note.");if(d.bool("canPost")||d.bool("canConfirmOrder"))Button(enabled=!saving,onClick={onPost(d.str("id"))}){Text(if(d.str("type")=="PURCHASE_ORDER")"Confirm order" else "Post")}}
   }
  }
 }
}
