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
fun MoneyScreen(initialMode:String,padding:PaddingValues,vm:AccountMoneyViewModel=viewModel(),initialOwnerId:String?=null) {
    val s=vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialMode,initialOwnerId){vm.show(initialMode);initialOwnerId?.let(vm::openOwnerHistory)}
    val caps=s.data["capabilities"]?.jsonObject
    fun can(key:String)=caps?.get(key)?.jsonPrimitive?.booleanOrNull==true
    val owners=s.data.array("owners")
    val ownerNames=owners.associate{it.jsonObject.str("id") to it.jsonObject.str("name")}
    val accountMode=s.mode in listOf("accounts","bank-accounts","cash-in-hand")
    val rows=when(s.mode){
        "accounts","bank-accounts","cash-in-hand"->moneyAccountRowsForMode(s.data["dashboard"]?.jsonObject?.array("accounts").orEmpty(),s.mode)
        "transfers"->s.data.array("transfers")
        "owners"->s.data.array("ownerTransactions")
        "loans"->s.data.array("loans")
        else->emptyList()
    }
    val canCreate=when(s.mode){"owners"->can("postOwnerTransactions");"loans"->can("manageLoans");else->can("postMoneyEntries")}
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)){
        LazyRow{items(listOf("bank-accounts","cash-in-hand","accounts","transfers","owners","loans")){mode->FilterChip(s.mode==mode,{if(!s.saving)vm.show(mode)},{Text(when(mode){"bank-accounts"->"Bank Accounts";"cash-in-hand"->"Cash In-Hand";"accounts"->"All accounts";"owners"->"Capital & drawings";else->mode.replaceFirstChar{it.uppercase()}})})}}
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.End){
            IconButton(vm::load,enabled=!s.saving){Icon(Icons.Default.Refresh,"Refresh")}
            if(s.mode=="owners"&&can("manageOwners"))TextButton({vm.create("owner-setup")},enabled=!s.saving){Text("Add owner / partner")}
            if(canCreate)FilledIconButton({vm.create(if(accountMode)"accounts"else s.mode)},enabled=!s.saving){Icon(Icons.Default.Add,"New transaction")}
        }
        if(s.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
        s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        LazyColumn{
            if(s.mode=="owners"){
                items(owners){entry->val owner=entry.jsonObject
                    ListItem(headlineContent={Text(owner.str("name"),fontWeight=FontWeight.Bold)},supportingContent={Text(moneyTypeLabel(owner.str("partyType"))+" · "+if(owner["isActive"]?.jsonPrimitive?.booleanOrNull!=false)"Active" else "Inactive")},trailingContent={if(can("manageOwners"))TextButton({vm.editOwner(owner)},enabled=!s.saving){Text("Edit")}},modifier=Modifier.clickable(enabled=!s.saving){vm.openOwnerHistory(owner.str("id"))})
                }
                if(owners.isEmpty())item{Text("No owners or partners yet.")}
                item{Text("Transaction history",fontWeight=FontWeight.Bold)}
            }
            items(rows){entry->val row=entry.jsonObject
                val title=if(s.mode=="owners")ownerNames[row.str("ownerFinancialAccountId")]?:"Owner" else row.str("name").ifBlank{row.str("lender").ifBlank{moneyTypeLabel(row.str("type"))}}
                ListItem(headlineContent={Text(title,fontWeight=FontWeight.Bold)},supportingContent={Text(listOf(if(s.mode=="owners")moneyTypeLabel(row.str("type")) else "",accountDate(row.str("transferDate")),accountDate(row.str("transactionDate")),accountDate(row.str("startDate")),row.str("reference")).filter{it.isNotBlank()}.joinToString(" · "))},trailingContent={Column{
                    Text(accountMoney(row.str("balance").ifBlank{row.str("amount").ifBlank{row.str("principal")}}))
                    if(s.mode=="loans"&&can("manageLoans")&&row.str("status")=="ACTIVE")TextButton({vm.loanPayment(row)},enabled=!s.saving){Text("Repay")}
                    if(accountMode&&can("postMoneyEntries")&&row["isActive"]?.jsonPrimitive?.booleanOrNull==true)TextButton({vm.disableAccount(row.str("id"))},enabled=!s.saving){Text("Deactivate")}
                }},modifier=if(accountMode&&can("postMoneyEntries"))Modifier.clickable(enabled=!s.saving){vm.editAccount(row)}else Modifier)
            }
            if(rows.isEmpty()&&!s.loading&&s.error==null)item{Text(if(accountMode)"No accounts available."else "No transactions available.")}
        }
    }
    if (s.historyOwnerId != null) {
        AlertDialog(
            onDismissRequest = vm::closeOwnerHistory,
            title = { Text(s.history?.get("owner")?.jsonObject?.str("name") ?: "Owner history") },
            text = {
                Column {
                    OutlinedTextField(s.historyFrom, { vm.historyDates(it, s.historyTo) }, label = { Text("From (YYYY-MM-DD)") }, enabled = !s.historyLoading)
                    OutlinedTextField(s.historyTo, { vm.historyDates(s.historyFrom, it) }, label = { Text("To (YYYY-MM-DD)") }, enabled = !s.historyLoading)
                    TextButton({ vm.loadOwnerHistory(0) }, enabled = !s.historyLoading) { Text("Apply dates") }
                    if (s.historyLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
                    s.historyError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    val historyRows = s.history?.array("items").orEmpty()
                    if (!s.historyLoading && s.historyError == null && s.history != null && historyRows.isEmpty()) Text("No transactions match these dates.")
                    LazyColumn(Modifier.heightIn(max = 280.dp)) {
                        items(historyRows) { entry ->
                            val row = entry.jsonObject
                            ListItem(
                                headlineContent = { Text(moneyTypeLabel(row.str("type"))) },
                                supportingContent = {
                                    Column {
                                        Text(accountDate(row.str("transactionDate")) + " · " + row.str("moneyAccountName"))
                                        Text("Status: " + row.str("journalStatus"))
                                        if (row.str("reference").isNotBlank()) Text(row.str("reference"))
                                        val reversal = row["reversal"] as? JsonObject
                                        reversal?.let { Text("Reversed " + accountDate(it.str("date")) + ": " + it.str("reason")) }
                                    }
                                },
                                trailingContent = { Text(accountMoney(row.str("amount"))) }
                            )
                        }
                    }
                    Row {
                        if (s.historyOffset > 0) TextButton({ vm.loadOwnerHistory((s.historyOffset - 50).coerceAtLeast(0)) }, enabled = !s.historyLoading) { Text("Previous") }
                        if (s.history?.get("hasMore")?.jsonPrimitive?.booleanOrNull == true) TextButton({ vm.loadOwnerHistory(s.historyOffset + 50) }, enabled = !s.historyLoading) { Text("Next") }
                    }
                }
            },
            confirmButton = { TextButton(vm::closeOwnerHistory) { Text("Close") } }
        )
    }
    s.editing?.let{MoneyEditor(it,s.data,s.selected,s.saving,s.error,vm::close,vm::save,initialAccountType=if(s.mode=="cash-in-hand")"CASH"else"BANK")}
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
    var amount by remember{mutableStateOf("")}
    var interest by remember{mutableStateOf("0")}
    var charges by remember{mutableStateOf("0")}
    var date by remember{mutableStateOf(java.time.LocalDate.now().toString())}
    var reference by remember{mutableStateOf("")}
    val accounts=data["dashboard"]?.jsonObject?.array("accounts").orEmpty()
    val valid=when{
        identity->name.isNotBlank()&&(kind=="owner-edit"||branch.isNotBlank())
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
            }else if(kind=="accounts"){
                item{OutlinedTextField(name,{name=it},label={Text("Account name")},enabled=!saving)}
                item{if(selected==null)PickText("Account type",type,listOf("CASH","BANK","PETTY_CASH"),enabled=!saving){type=it}else Text("Account type: ${moneyTypeLabel(type)} (cannot be changed)")}
                if(selected==null)item{Pick("Branch (optional)",branch,data.array("branches"),enabled=!saving){branch=it}}
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
            kind=="accounts"->{put("name",name);if(selected==null){put("type",type);branch.takeIf{it.isNotBlank()}?.let{put("branchId",it)}}}
            else->{put("branchId",branch);put("moneyAccountId",source);put("reference",reference);put("idempotencyKey",requestKey);when(kind){
                "transfers"->{put("sourceAccountId",source);put("destinationAccountId",destination);put("transferDate",date);put("amount",amount)}
                "owners"->{put("ownerFinancialAccountId",owner);put("type",type);put("transactionDate",date);put("amount",amount)}
                "loans"->{put("lender",name);put("loanType","TERM");put("principal",amount);put("interestRate",interest);put("startDate",date)}
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
