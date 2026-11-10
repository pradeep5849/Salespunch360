package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.CustomerReceiptViewModel
import com.salespunch360.mobile.ui.account.accountMoney
import com.salespunch360.mobile.ui.account.accountDate
import java.math.BigDecimal

@Composable
fun CustomerReceiptScreen(padding:PaddingValues,duplicateId:String?=null,initialProjectId:String?=null,requestedType:String?=null,initialBranchId:String?=null,vm:CustomerReceiptViewModel=viewModel()){
 if(requestedType=="APPLY_ADVANCE"){AdvanceApplicationScreen(padding,duplicateId,initialProjectId,requestedType,initialBranchId,vm);return}
 val s=vm.state.collectAsStateWithLifecycle().value
 LaunchedEffect(s.loading,initialProjectId,requestedType){vm.initialRoute(initialProjectId,requestedType,initialBranchId)}
 LaunchedEffect(duplicateId,s.loading){vm.duplicate(duplicateId)}
 var query by remember{mutableStateOf("")};var editor by remember{mutableStateOf<String?>(null)};var name by remember{mutableStateOf("")};var phone by remember{mutableStateOf("")};var accountType by remember{mutableStateOf("CASH")};var more by remember{mutableStateOf(false)}
 var draftLinks by remember{mutableStateOf<Map<String,String>>(emptyMap())};var draftAmount by remember{mutableStateOf("")}
 val invoices=s.invoices.filter{it.branchId==s.branchId&&it.customerId==s.customerId&&(s.projectId.isBlank()||it.projectId==s.projectId)}
 fun total(links:Map<String,String>)=links.values.mapNotNull{it.toBigDecimalOrNull()}.fold(BigDecimal.ZERO){sum,value->sum+value}
 val linked=total(s.links);val full=(s.amount.toBigDecimalOrNull()?:BigDecimal.ZERO)>BigDecimal.ZERO&&linked.compareTo(s.amount.toBigDecimalOrNull()?:BigDecimal.ZERO)==0
 val locked=s.loading||s.saving||s.uncertain
 Scaffold(modifier=Modifier.padding(padding),bottomBar={Surface(tonalElevation=3.dp){Row(Modifier.fillMaxWidth().padding(10.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton(onClick=vm::saveAndNew,enabled=!s.loading&&!s.saving,modifier=Modifier.weight(1f)){Text("Save & New")};Button(onClick={vm.save()},enabled=!s.loading&&!s.saving,modifier=Modifier.weight(1f)){Text(if(s.saving)"Saving…"else"Save")};Box{TextButton(onClick={more=true},enabled=!s.loading&&!s.saving){Text("⋮")};DropdownMenu(expanded=more,onDismissRequest={more=false}){DropdownMenuItem(text={Text("Share")},onClick={more=false;vm.save()});DropdownMenuItem(text={Text("Print")},onClick={more=false;vm.save()})}}}}}){inner->
 LazyColumn(Modifier.fillMaxSize().padding(inner),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Payment-In",style=MaterialTheme.typography.headlineSmall);if(s.companyName.isNotBlank())Text("Firm: ${s.companyName}")}
  if(s.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  s.error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}};s.message?.let{item{Text(it)}}
  item{Text("Receipt No.: ${if(full)s.receiptNumber.ifBlank{"Assigned when saved"}else s.advanceNumber.ifBlank{"Assigned when saved"}}");Text("Preview only; confirmed number is assigned when saved.",style=MaterialTheme.typography.bodySmall);OutlinedTextField(s.date,{value->vm.update{it.copy(date=value)}},enabled=!locked,label={Text("Date (YYYY-MM-DD)")},modifier=Modifier.fillMaxWidth())}
  if(s.branches.size>1)item{SelectField("Branch",s.branchId,s.branches.map{it.id to it.name}){value->vm.update{it.copy(branchId=value,customerId="",projectId="",invoiceId="",links=emptyMap(),moneyAccountId="")}}}
  item{OutlinedTextField(query,{query=it},enabled=!locked,label={Text("Search customer name or mobile")},modifier=Modifier.fillMaxWidth());SelectField("Customer Name",s.customerId,s.customers.filter{(it.branchId==null||it.branchId==s.branchId)&&(it.id==s.customerId||"${it.name} ${it.phone.orEmpty()}".contains(query,true))}.map{it.id to it.name}){value->vm.update{it.copy(customerId=value,projectId="",invoiceId="")}};TextButton(enabled=!locked,onClick={name="";phone="";editor="party"}){Text("+ Add New Party")}}
  if(s.projects.isNotEmpty())item{SelectField("Project",s.projectId,listOf("" to "No Project")+s.projects.filter{it.branchId==s.branchId&&s.projectCustomers[it.id]==s.customerId}.map{it.id to it.name}){value->if(!locked)vm.update{it.copy(projectId=value,invoiceId="",links=emptyMap())}}}
  if(s.customerId.isNotBlank())item{Text("Party Balance: ${s.balance?.let{accountMoney(it)}?:"Loading…"}");s.reviewError?.let{Text(it,color=MaterialTheme.colorScheme.error)}}
  item{OutlinedTextField(s.billingName,{value->vm.update{it.copy(billingName=value)}},enabled=!locked,label={Text("Billing Name (optional)")},modifier=Modifier.fillMaxWidth())}
  item{OutlinedTextField(s.amount,{value->vm.update{it.copy(amount=value)}},enabled=!locked,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),label={Text("Received")},modifier=Modifier.fillMaxWidth());if(s.customerId.isNotBlank()&&s.type=="CUSTOMER_RECEIPT")TextButton(enabled=!locked,onClick={draftLinks=s.links.toMap();draftAmount=s.amount;editor="links"}){Text("Link")};Text("Total Amount: ${accountMoney(s.amount.ifBlank{"0"})}");Text("Unused credit: ${accountMoney(((s.amount.toBigDecimalOrNull()?:BigDecimal.ZERO)-linked).toPlainString())}")}
  item{SelectField("Payment Type",s.moneyAccountId,s.moneyAccounts.filter{it.branchId==null||it.branchId==s.branchId}.map{it.id to it.name}){value->val account=s.moneyAccounts.find{it.id==value};vm.update{it.copy(moneyAccountId=value,mode=if(account?.rate=="CASH"||account?.rate=="PETTY_CASH")"CASH"else"BANK")}};TextButton(enabled=!locked,onClick={name="";accountType="CASH";editor="account"}){Text("+ Add Payment Type")}}
  item{OutlinedTextField(s.notes,{value->vm.update{it.copy(notes=value)}},enabled=!locked,label={Text("Description")},modifier=Modifier.fillMaxWidth())}
  item{com.salespunch360.mobile.ui.account.PaymentEvidencePicker(s.evidenceFiles,!locked){files->vm.update{it.copy(evidenceFiles=files)}}}
  if(s.uncertain)item{Text("Connection interrupted. Draft changes are locked until you retry this same receipt and confirm the result.")}
 }
 }
 if(editor=="links")Dialog(onDismissRequest={editor=null},properties=DialogProperties(usePlatformDefaultWidth=false)){Surface(Modifier.fillMaxSize()){Column(Modifier.padding(16.dp)){Text("Link Payment To Txns",style=MaterialTheme.typography.titleLarge);OutlinedTextField(draftAmount,{draftAmount=it},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),label={Text("Total Received")});LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(10.dp)){if(invoices.isEmpty())item{Text("No eligible invoices for this customer and branch.")};items(invoices,key={it.id}){invoice->Card{Column(Modifier.padding(12.dp)){Row{Checkbox(draftLinks.containsKey(invoice.id),{checked->draftLinks=if(checked)draftLinks+(invoice.id to "")else draftLinks-invoice.id});Text("Invoice ${invoice.number}")};Text("Date: ${accountDate(invoice.issueDate)}");Text("Original amount: ${accountMoney(invoice.originalAmount.ifBlank{invoice.outstanding})}");Text("Outstanding: ${accountMoney(invoice.outstanding)}");if(draftLinks.containsKey(invoice.id))OutlinedTextField(draftLinks[invoice.id].orEmpty(),{draftLinks=draftLinks+(invoice.id to it)},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),label={Text("Link Amount")})}}}};val remaining=(draftAmount.toBigDecimalOrNull()?:BigDecimal.ZERO)-total(draftLinks);val invalid=draftAmount.toBigDecimalOrNull()?.let{it.signum()>0&&it.scale()<=2}!=true||remaining.signum()<0||draftLinks.any{(id,value)->val n=value.toBigDecimalOrNull();n==null||n.signum()<=0||n.scale()>2||n>(invoices.find{it.id==id}?.outstanding?.toBigDecimalOrNull()?:BigDecimal.ZERO)};Text("Unused Amount: ${accountMoney(remaining.toPlainString())}");if(invalid)Text("Enter positive link amounts within invoice balances and total received.",color=MaterialTheme.colorScheme.error);Row{TextButton(onClick={editor=null}){Text("Cancel")};Button(enabled=!invalid,onClick={vm.update{it.copy(amount=draftAmount,links=draftLinks,multipleLinks=true,discountAmount="")};editor=null}){Text("Done")}}}}}
 if(editor=="party"||editor=="account")AlertDialog(onDismissRequest={if(!s.saving)editor=null},title={Text(if(editor=="party")"Add New Party"else"Add Payment Type")},text={Column{OutlinedTextField(name,{name=it},enabled=!s.saving,label={Text("Name")});if(editor=="party")OutlinedTextField(phone,{phone=it},enabled=!s.saving,label={Text("Mobile number")})else SelectField("Account type",accountType,listOf("CASH" to "Cash","BANK" to "Bank")){accountType=it};s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}}},confirmButton={Button(enabled=!s.saving&&name.isNotBlank(),onClick={if(editor=="party")vm.createParty(name,phone){editor=null}else vm.createAccount(name,accountType){editor=null}}){Text(if(s.saving)"Saving…"else"Save and select")}},dismissButton={TextButton(enabled=!s.saving,onClick={editor=null}){Text("Cancel")}})
 s.saved?.let{row->AlertDialog(onDismissRequest=vm::clearSaved,title={Text("Receipt saved: ${row.number}")},text={Column{Text("${accountMoney(row.amount)} · ${accountDate(row.date)}");com.salespunch360.mobile.ui.account.DocumentPrintActions(row.type,row.id,row.number)}},confirmButton={TextButton(onClick=vm::clearSaved){Text("Close")}})}
}
