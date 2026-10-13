package com.salespunch360.mobile.ui.account.money

import com.salespunch360.mobile.ui.account.accountDate
import com.salespunch360.mobile.ui.account.accountMoney
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountMoneyViewModel
import com.salespunch360.mobile.account.*
import kotlinx.serialization.json.*

@Composable
fun MoneyScreen(initialMode:String,padding:PaddingValues,vm:AccountMoneyViewModel=viewModel(),initialOwnerId:String?=null,initialQuery:String="") {
    val s=vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialMode,initialOwnerId,initialQuery){vm.show(initialMode,initialQuery);initialOwnerId?.let(vm::openOwnerHistory)}
    val caps=s.data["capabilities"]?.jsonObject
    fun can(key:String)=caps?.get(key)?.jsonPrimitive?.booleanOrNull==true
    val owners=s.data.array("owners")
    val ownerNames=owners.associate{it.jsonObject.str("id") to it.jsonObject.str("name")}
    val accountMode=s.mode in listOf("accounts","bank-accounts","cash-in-hand")
    val rows=when(s.mode){
        "accounts","bank-accounts","cash-in-hand"->moneyAccountRowsForMode(s.data["dashboard"]?.jsonObject?.array("accounts").orEmpty(),s.mode)
        "transfers"->s.data.array("transfers")
        "owners"->s.data.array("ownerTransactions")
        "loans"->s.loanOverview?.array("rows").orEmpty()
        else->emptyList()
    }
    val canCreate=when(s.mode){"owners"->can("postOwnerTransactions");"loans"->can("manageLoans");else->can("postMoneyEntries")}
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)){
        s.data["branchContext"]?.jsonObject?.let{context->Text("Scope: "+if(context.str("mode")=="COMPANY")"All company branches"else context.str("branchName"))}
        LazyRow{items(listOf("bank-accounts","cash-in-hand","accounts","transfers","owners","loans")){mode->FilterChip(s.mode==mode,{if(!s.saving)vm.show(mode)},{Text(when(mode){"bank-accounts"->"Bank Accounts";"cash-in-hand"->"Cash In-Hand";"accounts"->"All accounts";"owners"->"Capital & drawings";else->mode.replaceFirstChar{it.uppercase()}})})}}
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.End){
            IconButton(vm::load,enabled=!s.saving){Icon(Icons.Default.Refresh,"Refresh")}
            if(s.mode=="owners"&&can("manageOwners"))TextButton({vm.create("owner-setup")},enabled=!s.saving){Text("Add owner / partner")}
            if(canCreate)FilledIconButton({vm.create(if(accountMode)"accounts"else s.mode)},enabled=!s.saving&&!s.loading){Icon(Icons.Default.Add,"New transaction")}
        }
        if(s.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
        s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        if(s.mode=="loans"){
            OutlinedTextField(s.loanSearch,vm::searchLoans,label={Text("Search loans")},enabled=!s.loading&&!s.saving)
            TextButton({vm.loanPage(0)},enabled=!s.loading&&!s.saving){Text("Search")}
            s.loanOverview?.let{loans->Text("Posted outstanding: "+accountMoney(loans.str("outstanding")));if((loans["unpostedBalanceCount"]?.jsonPrimitive?.intOrNull?:0)>0)Text("Some loan starting balances have not been established.")}
            Row{if(s.loanOffset>0)TextButton({vm.loanPage((s.loanOffset-50).coerceAtLeast(0))},enabled=!s.loading){Text("Previous loans")};s.loanOverview?.get("nextOffset")?.jsonPrimitive?.intOrNull?.let{next->TextButton({vm.loanPage(next)},enabled=!s.loading){Text("Next loans")}}}
        }
        LazyColumn{
            if(s.mode=="owners"){
                items(owners){entry->val owner=entry.jsonObject
                    ListItem(headlineContent={Text(owner.str("name"),fontWeight=FontWeight.Bold)},supportingContent={Text(moneyTypeLabel(owner.str("partyType"))+" · "+if(owner["isActive"]?.jsonPrimitive?.booleanOrNull!=false)"Active" else "Inactive")},trailingContent={if(can("manageOwners"))TextButton({vm.editOwner(owner)},enabled=!s.saving){Text("Edit")}},modifier=Modifier.clickable(enabled=!s.saving){vm.openOwnerHistory(owner.str("id"))})
                }
                if(owners.isEmpty())item{Text("No owners or partners yet.")}
                item{Text("Transaction history",fontWeight=FontWeight.Bold)}
            }
            items(rows){entry->val row=entry.jsonObject
                val title=if(s.mode=="owners")ownerNames[row.str("ownerFinancialAccountId")]?:"Owner" else row.str("name").ifBlank{row.str("displayName").ifBlank{row.str("lender").ifBlank{moneyTypeLabel(row.str("type"))}}}
                ListItem(headlineContent={Text(title,fontWeight=FontWeight.Bold)},supportingContent={Text(listOf(if(s.mode=="owners")moneyTypeLabel(row.str("type")) else "",accountDate(row.str("transferDate")),accountDate(row.str("transactionDate")),accountDate(row.str("startDate")),row.str("reference")).filter{it.isNotBlank()}.joinToString(" · "))},trailingContent={Column{
                    if(s.mode=="loans")Text(row["outstanding"]?.jsonPrimitive?.contentOrNull?.let{accountMoney(it)}?:"Balance not established")else Text(accountMoney(row.str("balance").ifBlank{row.str("amount").ifBlank{row.str("principal")}}))
                    if(s.mode=="loans"&&can("manageLoans")&&row.str("status")=="ACTIVE")TextButton({vm.loanPayment(row)},enabled=!s.saving){Text("Repay")}
                    if(accountMode&&can("postMoneyEntries"))TextButton({vm.editAccount(row)},enabled=!s.saving){Text("Edit")}
                    if(accountMode&&can("postMoneyEntries")&&row["isActive"]?.jsonPrimitive?.booleanOrNull==true)TextButton({vm.disableAccount(row.str("id"))},enabled=!s.saving){Text("Deactivate")}
                }},modifier=if(accountMode)Modifier.clickable(enabled=!s.saving){vm.openMoneyHistory(row.str("id"))}else if(s.mode=="loans")Modifier.clickable(enabled=!s.saving){vm.openLoanHistory(row.str("id"))}else Modifier)
            }
            if(rows.isEmpty()&&!s.loading&&s.error==null)item{Text(if(accountMode)"No accounts available."else "No transactions available.")}
        }
    }
    if (s.historyOwnerId != null) {
        AlertDialog(
            onDismissRequest = vm::closeOwnerHistory,
            title = { Text(if(s.historyIsLoan) s.history?.get("loan")?.jsonObject?.let{it.str("displayName").ifBlank{it.str("lender")}}?:"Loan statement" else s.history?.get(if(s.historyIsAccount)"account" else "owner")?.jsonObject?.str("name") ?: "Owner history") },
            text = {
                Column {
                    if(!s.historyIsLoan){OutlinedTextField(s.historyFrom, { vm.historyDates(it, s.historyTo) }, label = { Text("From (YYYY-MM-DD)") }, enabled = !s.historyLoading)
                    OutlinedTextField(s.historyTo, { vm.historyDates(s.historyFrom, it) }, label = { Text("To (YYYY-MM-DD)") }, enabled = !s.historyLoading)
                    TextButton({ vm.loadOwnerHistory(0) }, enabled = !s.historyLoading) { Text("Apply dates") }}
                    if (s.historyLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
                    s.historyError?.let { Text(it, color = MaterialTheme.colorScheme.error);TextButton({vm.loadOwnerHistory(s.historyOffset)},enabled=!s.historyLoading){Text("Retry statement")}}
                    if(s.historyIsLoan)s.history?.let{h->Text("Outstanding: "+(h["outstanding"]?.jsonPrimitive?.contentOrNull?.let{accountMoney(it)}?:"Not established"));h["loan"]?.jsonObject?.let{loan->Text("Original principal: "+accountMoney(loan.str("principal")));Text("Status: "+loan.str("status"));Text("Account number: "+loan.str("loanAccountNumber").ifBlank{"Not provided"});Text("Description: "+loan.str("description").ifBlank{"Not provided"});Text("Duration (months): "+loan.str("durationMonths").ifBlank{"Not provided"})}}
                    if(s.historyIsAccount)s.history?.let{h->Text("Opening: "+accountMoney(h.str("opening")));Text("Money in: "+accountMoney(h.str("debit")));Text("Money out: "+accountMoney(h.str("credit")));Text("Closing: "+accountMoney(h.str("closing")))}
                    val historyRows = s.history?.array(if(s.historyIsAccount||s.historyIsLoan)"rows" else "items").orEmpty()
                    if (!s.historyLoading && s.historyError == null && s.history != null && historyRows.isEmpty()) Text("No transactions match these dates.")
                    LazyColumn(Modifier.heightIn(max = 280.dp)) {
                        items(historyRows) { entry ->
                            val row = entry.jsonObject
                            ListItem(
                                headlineContent = { Text(if(s.historyIsAccount||s.historyIsLoan)row.str("journalNumber")else moneyTypeLabel(row.str("type"))) },
                                supportingContent = {
                                    Column {
                                        if(s.historyIsLoan){Text(accountDate(row.str("entryDate")));Text(row.str("sourceType"));Text("Principal increase: "+accountMoney(row.str("credit"))+" · decrease: "+accountMoney(row.str("debit")));row["payment"]?.jsonPrimitive?.contentOrNull?.let{Text("Payment total: "+accountMoney(it))}}else if(s.historyIsAccount){Text(accountDate(row.str("entryDate")));Text(row.str("narration").ifBlank{row.str("sourceType")});Text("In: "+accountMoney(row.str("debit"))+" · Out: "+accountMoney(row.str("credit")))}else Text(accountDate(row.str("transactionDate")) + " · " + row.str("moneyAccountName"))
                                        Text("Status: " + row.str(if(s.historyIsAccount||s.historyIsLoan)"status"else "journalStatus"))
                                        if (row.str("reference").isNotBlank()) Text(row.str("reference"))
                                        val reversal = row["reversal"] as? JsonObject
                                        reversal?.let { Text("Reversed " + accountDate(it.str("date")) + ": " + it.str("reason")) }
                                    }
                                },
                                trailingContent = { Text(accountMoney(row.str(if(s.historyIsAccount||s.historyIsLoan)"balance"else "amount"))) }
                            )
                        }
                    }
                    Row {
                        if (s.historyOffset > 0) TextButton({ vm.loadOwnerHistory((s.historyOffset - 50).coerceAtLeast(0)) }, enabled = !s.historyLoading) { Text("Previous") }
                        if (if(s.historyIsAccount||s.historyIsLoan)s.historyOffset+50<(s.history?.get("total")?.jsonPrimitive?.intOrNull?:0)else s.history?.get("hasMore")?.jsonPrimitive?.booleanOrNull == true) TextButton({ vm.loadOwnerHistory(s.historyOffset + 50) }, enabled = !s.historyLoading) { Text("Next") }
                    }
                }
            },
            confirmButton = { Row { if(s.historyIsAccount&&can("postMoneyEntries"))s.history?.get("account")?.jsonObject?.takeIf{it["isActive"]?.jsonPrimitive?.booleanOrNull==true}?.let{row->TextButton({vm.adjustAccount(row)}){Text("Add / Reduce")}};TextButton(vm::closeOwnerHistory) { Text("Close") } } }
        )
    }
    s.editing?.let{MoneyEditor(it,s.data,s.selected,s.saving,s.error,vm::close,vm::save,initialAccountType=moneyAccountInitialType(s.mode,initialQuery))}
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoneyEditor(kind:String,data:JsonObject,selected:JsonObject?,saving:Boolean,error:String?,close:()->Unit,save:(String,JsonObject)->Unit,initialAccountType:String="BANK"){
    val requestKey=remember{java.util.UUID.randomUUID().toString()}
    var branch by remember{mutableStateOf("")}
    var source by remember{mutableStateOf("")}
    var destination by remember{mutableStateOf("")}
    var owner by remember{mutableStateOf("")}
    var name by remember{mutableStateOf(selected?.str("name").orEmpty())}
    val identity=kind=="owner-setup"||kind=="owner-edit"
    var type by remember{mutableStateOf(if(kind=="owners")"INVESTMENT" else if(identity)selected?.str("partyType").orEmpty().ifBlank{"OWNER"} else selected?.str("type").orEmpty().ifBlank{initialAccountType})}
    var phone by remember{mutableStateOf(selected?.str("phone").orEmpty())}
    var email by remember{mutableStateOf(selected?.str("email").orEmpty())}
    var address by remember{mutableStateOf(selected?.str("address").orEmpty())}
    var active by remember{mutableStateOf(selected?.get("isActive")?.jsonPrimitive?.booleanOrNull?:true)}
    var offsetLedger by remember{mutableStateOf("")}
    var adjustmentReason by remember{mutableStateOf("")}
    var direction by remember{mutableStateOf("ADD")}
    var openingBranch by remember{mutableStateOf("")}
    var amount by remember{mutableStateOf("")}
    var interest by remember{mutableStateOf("0")}
    var loanName by remember{mutableStateOf("")}
    var loanNumber by remember{mutableStateOf("")}
    var loanDescription by remember{mutableStateOf("")}
    var loanDuration by remember{mutableStateOf("")}
    var loanType by remember{mutableStateOf("TERM")}
    var charges by remember{mutableStateOf("0")}
    var date by remember{mutableStateOf(java.time.LocalDate.now().toString())}
    var reference by remember{mutableStateOf("")}
    val accounts=data["dashboard"]?.jsonObject?.array("accounts").orEmpty()
    val valid=when{
        identity->name.isNotBlank()&&(kind=="owner-edit"||branch.isNotBlank())
        kind=="adjustments"->branch.isNotBlank()&&offsetLedger.isNotBlank()&&amount.isNotBlank()&&adjustmentReason.trim().length>=3
        kind=="accounts"->name.isNotBlank()
        else->source.isNotBlank()&&amount.isNotBlank()&&branch.isNotBlank()&&(kind!="owners"||owner.isNotBlank())
    }
    AlertDialog(onDismissRequest={if(!saving)close()},title={Text(if(identity)"Owner / partner" else kind.replace('-',' ').replaceFirstChar{it.uppercase()})},text={
        LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
            if(identity){
                item{OutlinedTextField(name,{name=it},label={Text("Owner / partner name")},enabled=!saving)}
                item{PickText("Type",type,listOf("OWNER","PARTNER"),enabled=!saving){type=it}}
                item{OutlinedTextField(phone,{phone=it},label={Text("Phone")},enabled=!saving)}
                item{OutlinedTextField(email,{email=it},label={Text("Email")},enabled=!saving)}
                item{OutlinedTextField(address,{address=it},label={Text("Address")},enabled=!saving)}
                if(kind=="owner-setup"){
                    item{Pick("App user (optional)",owner,data.array("users"),enabled=!saving){owner=it};if(owner.isNotBlank())TextButton({owner=""},enabled=!saving){Text("Clear app user")}}
                    item{Pick("Branch",branch,data.array("branches"),enabled=!saving){branch=it}}
                }else item{Row{Text("Active");Switch(active,{active=it},enabled=!saving)}}
            }else if(kind=="adjustments"){
                item{Text("Owner funding and withdrawals use Capital & drawings. Bank/cash movements use Transfers.")}
                item{Pick("Posting branch",branch,data.array("branches").filter{selected?.str("branchId").orEmpty().isBlank()||it.jsonObject.str("id")==selected?.str("branchId")},enabled=!saving){branch=it}}
                item{PickText("Adjustment",direction,listOf("ADD","REDUCE"),enabled=!saving){direction=it}}
                item{Pick("Offset ledger",offsetLedger,data["adjustmentOptions"]?.jsonObject?.array("ledgers").orEmpty(),enabled=!saving){offsetLedger=it}}
                item{OutlinedTextField(amount,{amount=it},label={Text("Amount")},enabled=!saving)}
                item{OutlinedTextField(date,{date=it},label={Text("Date (YYYY-MM-DD)")},enabled=!saving)}
                item{OutlinedTextField(adjustmentReason,{adjustmentReason=it},label={Text("Reason")},enabled=!saving)}
            }else if(kind=="accounts"){
                item{OutlinedTextField(name,{name=it},label={Text("Account name")},enabled=!saving)}
                item{if(selected==null)PickText("Account type",type,listOf("CASH","BANK","PETTY_CASH"),enabled=!saving){type=it}else Text("Account type: ${moneyTypeLabel(type)} (cannot be changed)")}
                if(selected==null){
                    item{Pick("Branch (optional)",branch,data.array("branches"),enabled=!saving){branch=it}}
                    item{OutlinedTextField(amount,{amount=it},label={Text("Starting balance (optional)")},enabled=!saving)}
                    item{OutlinedTextField(date,{date=it},label={Text("As on date (YYYY-MM-DD)")},enabled=!saving)}
                    if(branch.isBlank())item{Pick("Opening journal branch",openingBranch,data.array("branches"),enabled=!saving){openingBranch=it}}
                    item{Text("A non-zero starting balance posts against Opening Balance Equity.")}
                }
            }else{
                item{Pick("Branch",branch,data.array("branches"),enabled=!saving){branch=it}}
                if(kind=="transfers"){
                    item{Pick("Source account",source,accounts,enabled=!saving){source=it}}
                    item{Pick("Destination account",destination,accounts,enabled=!saving){destination=it}}
                }else item{Pick("Money account",source,accounts,enabled=!saving){source=it}}
                if(kind=="owners"){
                    item{Pick("Owner / partner",owner,data.array("owners").filter{it.jsonObject["isActive"]?.jsonPrimitive?.booleanOrNull!=false},enabled=!saving){owner=it}}
                    item{PickText("Transaction",type,listOf("INVESTMENT","CAPITAL_WITHDRAWAL","PROFIT_DISTRIBUTION")+if(data["capabilities"]?.jsonObject?.get("manageLoans")?.jsonPrimitive?.booleanOrNull==true)listOf("OWNER_LOAN")else emptyList(),enabled=!saving){type=it}}
                }
                if(kind=="loans"){
                    item{OutlinedTextField(loanName,{loanName=it},label={Text("Loan name")},enabled=!saving)}
                    item{OutlinedTextField(loanNumber,{loanNumber=it},label={Text("Loan account number")},enabled=!saving)}
                    item{OutlinedTextField(loanDescription,{loanDescription=it},label={Text("Description")},enabled=!saving)}
                    item{OutlinedTextField(loanDuration,{loanDuration=it},label={Text("Duration (months)")},enabled=!saving)}
                    item{OutlinedTextField(loanType,{loanType=it},label={Text("Loan type")},enabled=!saving)}
                    item{OutlinedTextField(name,{name=it},label={Text("Lender")},enabled=!saving)}
                    item{OutlinedTextField(interest,{interest=it},label={Text("Interest rate")},enabled=!saving)}
                }
                if(kind=="loan-payments"){
                    item{OutlinedTextField(interest,{interest=it},label={Text("Interest paid")},enabled=!saving)}
                    item{OutlinedTextField(charges,{charges=it},label={Text("Charges")},enabled=!saving)}
                }
                item{OutlinedTextField(amount,{amount=it},label={Text(if(kind=="loan-payments")"Principal paid" else "Amount")},enabled=!saving)}
                item{OutlinedTextField(date,{date=it},label={Text("Date")},enabled=!saving)}
                item{OutlinedTextField(reference,{reference=it},label={Text("Reference")},enabled=!saving)}
            }
            if(error!=null)item{Text(error,color=MaterialTheme.colorScheme.error)}
        }
    },confirmButton={Button(enabled=!saving&&valid,onClick={save(kind,buildJsonObject{
        when{
            identity->{put("name",name);put("partyType",type);put("phone",phone);put("email",email);put("address",address);if(kind=="owner-setup"){owner.takeIf{it.isNotBlank()}?.let{put("userId",it)};put("branchId",branch);put("creationRequestKey",requestKey)}else put("isActive",active)}
            kind=="adjustments"->{put("moneyAccountId",selected?.str("id").orEmpty());put("branchId",branch);put("direction",direction);put("offsetLedgerId",offsetLedger);put("amount",amount);put("date",date);put("reason",adjustmentReason);put("idempotencyKey",requestKey)}
            kind=="accounts"->{put("name",name);if(selected==null){put("type",type);branch.takeIf{it.isNotBlank()}?.let{put("branchId",it)};if(amount.isNotBlank()){put("openingBalance",amount);put("openingDate",date);if(branch.isBlank()&&openingBranch.isNotBlank())put("openingBranchId",openingBranch)}}}
            else->{put("branchId",branch);put("moneyAccountId",source);put("reference",reference);put("idempotencyKey",requestKey);when(kind){
                "transfers"->{put("sourceAccountId",source);put("destinationAccountId",destination);put("transferDate",date);put("amount",amount)}
                "owners"->{put("ownerFinancialAccountId",owner);put("type",type);put("transactionDate",date);put("amount",amount)}
                "loans"->{put("lender",name);put("loanType",loanType);put("displayName",loanName);put("loanAccountNumber",loanNumber);put("description",loanDescription);put("durationMonths",loanDuration);put("principal",amount);put("interestRate",interest);put("startDate",date)}
                "loan-payments"->{put("loanId",selected?.str("id").orEmpty());put("paymentDate",date);put("principal",amount);put("interest",interest);put("charges",charges)}
            }}
        }
    })}){Text(if(saving)"Saving…" else if(identity||kind=="accounts")"Save" else "Post transaction")}},dismissButton={TextButton(close,enabled=!saving){Text("Cancel")}})
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Pick(label:String,value:String,values:List<JsonElement>,enabled:Boolean=true,set:(String)->Unit){
    var open by remember{mutableStateOf(false)}
    val selected=values.map{it.jsonObject}.firstOrNull{it.str("id")==value}
    ExposedDropdownMenuBox(open,{if(enabled)open=it}){
        OutlinedTextField(selected?.str("name")?.ifBlank{null}?:selected?.str("lender").orEmpty(),{},readOnly=true,label={Text(label)},enabled=enabled,modifier=Modifier.menuAnchor())
        ExposedDropdownMenu(open,{open=false}){values.forEach{entry->val row=entry.jsonObject;DropdownMenuItem({Text(row.str("name").ifBlank{row.str("lender")})},{set(row.str("id"));open=false})}}
    }
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickText(label:String,value:String,values:List<String>,enabled:Boolean=true,set:(String)->Unit){
    var open by remember{mutableStateOf(false)}
    ExposedDropdownMenuBox(open,{if(enabled)open=it}){
        OutlinedTextField(moneyTypeLabel(value),{},readOnly=true,label={Text(label)},enabled=enabled,modifier=Modifier.menuAnchor())
        ExposedDropdownMenu(open,{open=false}){values.forEach{option->DropdownMenuItem({Text(moneyTypeLabel(option))},{set(option);open=false})}}
    }
}
private fun moneyTypeLabel(value:String)=when(value){"OWNER"->"Owner";"PARTNER"->"Partner";"INVESTMENT"->"Capital addition";"CAPITAL_WITHDRAWAL"->"Capital withdrawal";"PROFIT_DISTRIBUTION"->"Profit distribution";"WITHDRAWAL"->"Withdrawal (legacy)";"OWNER_LOAN"->"Owner loan received";"BANK"->"Bank";"CASH"->"Cash";"PETTY_CASH"->"Petty cash";else->value}
