package com.salespunch360.mobile.ui.account.money
import com.salespunch360.mobile.account.MoneyTransferMode
import com.salespunch360.mobile.account.transferModeAccepts

import com.salespunch360.mobile.ui.account.accountDate
import com.salespunch360.mobile.ui.account.accountMoney
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountMoneyViewModel
import com.salespunch360.mobile.account.*
import kotlinx.serialization.json.*

@Composable
fun MoneyScreen(initialMode:String,padding:PaddingValues,vm:AccountMoneyViewModel=viewModel(),initialOwnerId:String?=null,initialQuery:String="",onFunding:(()->Unit)?=null) {
    val imageContext=LocalContext.current;val imageScope=rememberCoroutineScope()
    var imagePreview by remember(initialMode,initialQuery){mutableStateOf<android.graphics.Bitmap?>(null)}
    var imageError by remember(initialMode,initialQuery){mutableStateOf<String?>(null)}
    var imageLoading by remember(initialMode,initialQuery){mutableStateOf(false)}
    fun viewTransferImage(id:String){if(imageLoading)return;imageLoading=true;imageError=null;imageScope.launch{try{val bytes=ApiClient(SecureSession(imageContext)).moneyTransferImage(id);imagePreview=withContext(Dispatchers.IO){android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)?:throw IllegalArgumentException("Image could not be displayed.")}}catch(error:kotlinx.coroutines.CancellationException){throw error}catch(error:Exception){imageError=error.message?:"Image could not be loaded."}finally{imageLoading=false}}}
    imagePreview?.let{bitmap->AlertDialog(onDismissRequest={imagePreview=null},title={Text("Transfer image")},text={Image(bitmap.asImageBitmap(),contentDescription="Transfer image",modifier=Modifier.fillMaxWidth().heightIn(max=400.dp))},confirmButton={TextButton(onClick={imagePreview=null}){Text("Close")}})}
    imageError?.let{message->AlertDialog(onDismissRequest={imageError=null},title={Text("Image unavailable")},text={Text(message)},confirmButton={TextButton(onClick={imageError=null}){Text("OK")}})}

    val s=vm.state.collectAsStateWithLifecycle().value
    LaunchedEffect(initialMode,initialOwnerId,initialQuery){vm.show(initialMode,initialQuery);initialOwnerId?.let(vm::openOwnerHistory)}
    val caps=s.data["capabilities"]?.jsonObject
    fun can(key:String)=caps?.get(key)?.jsonPrimitive?.booleanOrNull==true
    var correctionTransaction by rememberSaveable(initialMode,initialQuery){mutableStateOf<String?>(null)}
    var correctionOwner by rememberSaveable(initialMode,initialQuery){mutableStateOf("")}
    var correctionDate by rememberSaveable(initialMode,initialQuery){mutableStateOf("")}
    var correctionReason by rememberSaveable(initialMode,initialQuery){mutableStateOf("")}
    var correctionBusy by remember{mutableStateOf(false)}
    var correctionError by rememberSaveable(initialMode,initialQuery){mutableStateOf<String?>(null)}
    correctionTransaction?.let{transactionId->AlertDialog(
        onDismissRequest={if(!correctionBusy){correctionTransaction=null;correctionError=null}},
        title={Text("Reverse owner transaction")},
        text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
            Text("A dated reversal restores its bank/cash and owner ledger effects. The original stays in history.")
            OutlinedTextField(correctionDate,{correctionDate=it},label={Text("Correction date (YYYY-MM-DD)")},enabled=!correctionBusy,isError=!validOwnerCorrectionDate(correctionDate))
            OutlinedTextField(correctionReason,{correctionReason=it.take(1000)},label={Text("Reason")},enabled=!correctionBusy)
            correctionError?.let{Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.semantics{liveRegion=LiveRegionMode.Assertive})}
            if(correctionBusy)LinearProgressIndicator(Modifier.fillMaxWidth())
        }},
        confirmButton={TextButton(enabled=!correctionBusy&&validOwnerCorrectionDate(correctionDate)&&correctionReason.trim().length in 3..1000,onClick={
            val requestOwner=correctionOwner;val payload=ownerCorrectionPayload(transactionId,correctionDate,correctionReason,s.history?.get("scope")?.jsonObject?.get("branchId")?.jsonPrimitive?.contentOrNull.orEmpty())
            correctionBusy=true;correctionError=null
            imageScope.launch{try{ApiClient(SecureSession(imageContext)).ownerCorrection(requestOwner,payload);correctionTransaction=null;if(vm.state.value.historyOwnerId==requestOwner)vm.loadOwnerHistory(vm.state.value.historyOffset);vm.load()}catch(error:kotlinx.coroutines.CancellationException){throw error}catch(error:Exception){correctionError=error.message?:"Correction could not be posted. Your inputs were kept; retry."}finally{correctionBusy=false}}
        }){Text(if(correctionBusy)"Posting…" else "Post reversal")}},
        dismissButton={TextButton(enabled=!correctionBusy,onClick={correctionTransaction=null;correctionError=null}){Text("Cancel")}}
    )}

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
            if(s.mode=="owners"&&onFunding!=null)TextButton(onFunding,enabled=!s.saving){Text("Asset funding")}
            if(s.mode=="owners"&&can("manageOwners"))TextButton({vm.create("owner-setup")},enabled=!s.saving){Text("Add owner / partner")}
            if(canCreate)FilledIconButton({vm.create(if(accountMode)"accounts"else s.mode)},enabled=!s.saving&&!s.loading){Icon(Icons.Default.Add,"New transaction")}
        }
        if(s.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
        s.error?.let{Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.semantics{liveRegion=LiveRegionMode.Polite})}
        if(s.mode=="loans"){
            OutlinedTextField(s.loanSearch,vm::searchLoans,label={Text("Search loans")},enabled=!s.loading&&!s.saving)
            TextButton({vm.loanPage(0)},enabled=!s.loading&&!s.saving){Text("Search")}
            s.loanOverview?.let{loans->Text("Posted outstanding: "+accountMoney(loans.str("outstanding")));if((loans["unpostedBalanceCount"]?.jsonPrimitive?.intOrNull?:0)>0)Text("Some loan starting balances have not been established.")}
            Row{if(s.loanOffset>0)TextButton({vm.loanPage((s.loanOffset-50).coerceAtLeast(0))},enabled=!s.loading){Text("Previous loans")};s.loanOverview?.get("nextOffset")?.jsonPrimitive?.intOrNull?.let{next->TextButton({vm.loanPage(next)},enabled=!s.loading){Text("Next loans")}}}
        }
        LazyColumn{
            if(s.mode=="owners"){
                items(owners){entry->val owner=entry.jsonObject
                    ListItem(headlineContent={Text(owner.str("name"),fontWeight=FontWeight.Bold)},supportingContent={Column{Text(moneyTypeLabel(owner.str("partyType"))+" · "+if(owner["isActive"]?.jsonPrimitive?.booleanOrNull!=false)"Active" else "Inactive");owner["currentBalances"]?.jsonObject?.let{balances->Text("Capital: "+accountMoney(balances.str("capital")));Text("Profit drawings: "+accountMoney(balances.str("drawings")));Text("Owner loan: "+accountMoney(balances.str("loan")))}}},trailingContent={if(can("manageOwners"))TextButton({vm.editOwner(owner)},enabled=!s.saving){Text("Edit")}},modifier=Modifier.clickable(enabled=!s.saving){vm.openOwnerHistory(owner.str("id"))})
                }
                if(owners.isEmpty())item{Text("No owners or partners yet.")}
                item{Text("Transaction history",fontWeight=FontWeight.Bold)}
            }
            items(rows){entry->val row=entry.jsonObject
                val title=if(s.mode=="owners")ownerNames[row.str("ownerFinancialAccountId")]?:"Owner" else row.str("name").ifBlank{row.str("displayName").ifBlank{row.str("lender").ifBlank{moneyTypeLabel(row.str("type"))}}}
                ListItem(headlineContent={Text(title,fontWeight=FontWeight.Bold)},supportingContent={Text(listOf(if(s.mode=="owners")moneyTypeLabel(row.str("type")) else "",accountDate(row.str("transferDate")),accountDate(row.str("transactionDate")),accountDate(row.str("startDate")),row.str("reference"),if(s.mode=="transfers")row.str("description")else "").filter{it.isNotBlank()}.joinToString(" · "))},trailingContent={Column{if(s.mode=="transfers"&&row["image"] is JsonObject)TextButton(enabled=!imageLoading,onClick={viewTransferImage(row.str("id"))}){Text("View image")};
                    if(s.mode=="loans")Text(row["outstanding"]?.jsonPrimitive?.contentOrNull?.let{accountMoney(it)}?:"Balance not established")else Text(accountMoney(row.str("balance").ifBlank{row.str("amount").ifBlank{row.str("principal")}}))
                    if(s.mode=="loans"&&can("manageLoans")&&row.str("status")=="ACTIVE"&&row["archivedAt"]?.jsonPrimitive?.contentOrNull==null)TextButton({vm.loanPayment(row)},enabled=!s.saving){Text("Repay")}
                    if(accountMode&&can("postMoneyEntries"))TextButton({vm.editAccount(row)},enabled=!s.saving){Text("Edit")}
                    if(accountMode&&can("postMoneyEntries")&&row["isActive"]?.jsonPrimitive?.booleanOrNull==true)TextButton({vm.disableAccount(row.str("id"))},enabled=!s.saving){Text("Deactivate")}
                }},modifier=if(accountMode)Modifier.clickable(enabled=!s.saving){vm.openMoneyHistory(row.str("id"))}else if(s.mode=="loans")Modifier.clickable(enabled=!s.saving){vm.openLoanHistory(row.str("id"))}else Modifier)
            }
            if(rows.isEmpty()&&!s.loading&&s.error==null)item{Text(if(accountMode)"No accounts available."else "No transactions available.")}
        }
    }
    if (s.historyOwnerId != null && correctionTransaction == null) {
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
                    if(s.historyIsLoan)s.history?.let{h->if(h["ambiguousBalance"]?.jsonPrimitive?.booleanOrNull==true)Text("This legacy loan shares its liability ledger. Separate the opening balances before changing its financial history.");Text("Outstanding: "+(h["outstanding"]?.jsonPrimitive?.contentOrNull?.let{accountMoney(it)}?:"Not established"));h["loan"]?.jsonObject?.let{loan->Text("Original principal: "+accountMoney(loan.str("principal")));Text("Status: "+loan.str("status"));Text("Account number: "+loan.str("loanAccountNumber").ifBlank{"Not provided"});Text("Description: "+loan.str("description").ifBlank{"Not provided"});Text("Duration (months): "+loan.str("durationMonths").ifBlank{"Not provided"})}}
                    if(!s.historyIsAccount&&!s.historyIsLoan)s.history?.get("currentBalances")?.jsonObject?.let{balances->Text("Current balances in authorized branches (history dates do not change these)");Text("Capital: "+accountMoney(balances.str("capital")));Text("Profit drawings: "+accountMoney(balances.str("drawings")));Text("Owner loan: "+accountMoney(balances.str("loan")))}
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
                                        if(s.historyIsLoan){Text(accountDate(row.str("entryDate")));Text(row.str("sourceType"));if(row.str("narration").isNotBlank())Text(row.str("narration"));Text("Principal increase: "+accountMoney(row.str("credit"))+" · decrease: "+accountMoney(row.str("debit")));row["payment"]?.jsonPrimitive?.contentOrNull?.let{Text("Payment total: "+accountMoney(it))}}else if(s.historyIsAccount){Text(accountDate(row.str("entryDate")));Text(row.str("narration").ifBlank{row.str("sourceType")});Text("In: "+accountMoney(row.str("debit"))+" · Out: "+accountMoney(row.str("credit")))}else Text(accountDate(row.str("transactionDate")) + " · " + row.str("moneyAccountName"))
                                        Text("Status: " + row.str(if(s.historyIsAccount||s.historyIsLoan)"status"else "journalStatus"))
                                        if(!s.historyIsAccount&&!s.historyIsLoan&&s.history?.get("canCorrect")?.jsonPrimitive?.booleanOrNull==true&&row.str("journalStatus")=="POSTED")TextButton(enabled=!correctionBusy,onClick={correctionOwner=s.historyOwnerId.orEmpty();correctionTransaction=row.str("id");correctionDate=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString();correctionReason="";correctionError=null}){Text("Reverse transaction")}

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
            confirmButton = { Row { if(s.historyIsLoan&&can("manageLoans"))s.history?.get("loan")?.jsonObject?.let{loan->TextButton({vm.manageLoan(loan)},enabled=!s.saving&&!s.historyLoading){Text("Manage loan")};TextButton({vm.editLoanMetadata(loan)},enabled=!s.saving&&!s.historyLoading){Text("Edit loan details")}};if(s.historyIsAccount&&can("postMoneyEntries"))s.history?.get("account")?.jsonObject?.takeIf{it["isActive"]?.jsonPrimitive?.booleanOrNull==true}?.let{row->TextButton({vm.adjustAccount(row)}){Text("Add / Reduce")}};TextButton(vm::closeOwnerHistory) { Text("Close") } } }
        )
    }
    s.editing?.let{MoneyEditor(it,s.data,s.selected,s.saving,s.error,vm::close,vm::save,initialAccountType=moneyAccountInitialType(s.mode,initialQuery))}
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoneyEditor(kind:String,data:JsonObject,selected:JsonObject?,saving:Boolean,error:String?,close:()->Unit,save:(String,JsonObject)->Unit,initialAccountType:String="BANK"){
    val requestKey=remember{java.util.UUID.randomUUID().toString()}
    var branch by remember{mutableStateOf(if(kind in listOf("loan-payments","loan-operations"))selected?.str("branchId").orEmpty()else if(kind=="transfers")data["branchContext"]?.jsonObject?.str("branchId").orEmpty()else "")}
    var source by remember{mutableStateOf("")}
    var destination by remember{mutableStateOf("")}
    var transferMode by remember{mutableStateOf(MoneyTransferMode.BANK_TO_CASH)}
    var owner by remember{mutableStateOf("")}
    var fundingAmounts by remember{mutableStateOf<Map<String,String>>(emptyMap())}
    var name by remember{mutableStateOf(selected?.str("name").orEmpty())}
    val identity=kind=="owner-setup"||kind=="owner-edit"
    var type by remember{mutableStateOf(if(kind=="owners")"INVESTMENT" else if(identity)selected?.str("partyType").orEmpty().ifBlank{"OWNER"} else selected?.str("type").orEmpty().ifBlank{initialAccountType})}
    var phone by remember{mutableStateOf(selected?.str("phone").orEmpty())}
    var email by remember{mutableStateOf(selected?.str("email").orEmpty())}
    var address by remember{mutableStateOf(selected?.str("address").orEmpty())}
    var active by remember{mutableStateOf(selected?.get("isActive")?.jsonPrimitive?.booleanOrNull?:true)}
    var offsetLedger by remember{mutableStateOf("")}
    var adjustmentReason by remember{mutableStateOf("")}
    val loanArchived=selected?.get("archivedAt")?.jsonPrimitive?.contentOrNull!=null
    var loanAction by remember{mutableStateOf(if(loanArchived)"RESTORE"else if(selected?.str("status")=="CANCELLED")"ARCHIVE"else "TOP_UP")}
    var direction by remember{mutableStateOf("ADD")}
    var openingBranch by remember{mutableStateOf("")}
    var amount by remember{mutableStateOf("")}
    var interest by remember{mutableStateOf("0")}
    var loanName by remember{mutableStateOf(if(kind=="loan-edit")selected?.str("displayName").orEmpty()else "")}
    var loanNumber by remember{mutableStateOf(if(kind=="loan-edit")selected?.str("loanAccountNumber").orEmpty()else "")}
    var loanDescription by remember{mutableStateOf(if(kind=="loan-edit")selected?.str("description").orEmpty()else "")}
    var loanDuration by remember{mutableStateOf(if(kind=="loan-edit")selected?.str("durationMonths").orEmpty()else "")}
    var loanType by remember{mutableStateOf("TERM")}
    var bankName by remember{mutableStateOf(selected?.str("bankName").orEmpty())}
    var accountHolder by remember{mutableStateOf(selected?.str("accountHolderName").orEmpty())}
    var bankBranch by remember{mutableStateOf(selected?.str("bankBranchName").orEmpty())}
    var bankNumber by remember{mutableStateOf(selected?.str("accountNumberMasked").orEmpty())}
    var bankIfsc by remember{mutableStateOf(selected?.str("ifsc").orEmpty())}
    var bankUpi by remember{mutableStateOf(selected?.str("upiId").orEmpty())}
    var printBank by remember{mutableStateOf(selected?.get("printBankDetails")?.jsonPrimitive?.booleanOrNull?:false)}
    var printQr by remember{mutableStateOf(selected?.get("printUpiQr")?.jsonPrimitive?.booleanOrNull?:false)}
    var paymentDescription by remember{mutableStateOf("")}
    var charges by remember{mutableStateOf("0")}
    var date by remember{mutableStateOf(java.time.LocalDate.now().toString())}
    var reference by remember{mutableStateOf("")}
    var transferDescription by remember{mutableStateOf("")}
    val imageContext=LocalContext.current;val imageScope=rememberCoroutineScope()
    var transferImage by remember{mutableStateOf<JsonObject?>(null)}
    var transferImageLoading by remember{mutableStateOf(false)}
    var transferImageError by remember{mutableStateOf<String?>(null)}
    val imagePicker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()){uri->if(uri!=null)imageScope.launch{transferImageLoading=true;transferImage=null;transferImageError=null;try{transferImage=readTransferImageInput(imageContext,uri)}catch(error:kotlinx.coroutines.CancellationException){throw error}catch(error:Exception){transferImageError=error.message?:"Image could not be read."}finally{transferImageLoading=false}}}

    val accounts=data["dashboard"]?.jsonObject?.array("accounts").orEmpty().filter{entry->val row=entry.jsonObject;row["isActive"]?.jsonPrimitive?.booleanOrNull!=false&&(kind !in listOf("transfers","loans","loan-payments","loan-operations")||row.str("branchId").isBlank()||row.str("branchId")==branch)}
    val fundingReturns=if(kind=="owners"&&type=="CAPITAL_WITHDRAWAL")assetFundingReturns(data.array("fundingRepayments"),fundingAmounts,owner,branch,amount)else JsonArray(emptyList())
    val bankErrors=bankMetadataErrors(bankName,accountHolder,bankBranch,bankIfsc,bankUpi,printQr)
    val valid=when{
        identity->name.isNotBlank()&&(kind=="owner-edit"||branch.isNotBlank())
        kind=="transfers"->!transferImageLoading&&transferImageError==null&&branch.isNotBlank()&&source.isNotBlank()&&destination.isNotBlank()&&source!=destination&&loanPaymentTotal(amount)?.signum()==1&&accounts.any{it.jsonObject.str("id")==source&&transferModeAccepts(transferMode,it.jsonObject.str("type"),true)}&&accounts.any{it.jsonObject.str("id")==destination&&transferModeAccepts(transferMode,it.jsonObject.str("type"),false)}
        kind=="adjustments"->branch.isNotBlank()&&offsetLedger.isNotBlank()&&amount.isNotBlank()&&adjustmentReason.trim().length>=3
        kind=="loan-operations"->date.isNotBlank()&&(if(loanAction=="TOP_UP")source.isNotBlank()&&loanPaymentTotal(amount)?.signum()==1 else adjustmentReason.trim().length in 3..1000)
        kind=="loan-edit"->loanName.length<=240&&loanNumber.length<=160&&loanDescription.length<=2000&&(loanDuration.isBlank()||loanDuration.toIntOrNull()?.let{it in 1..1200}==true)
        kind=="loans"->source.isNotBlank()&&branch.isNotBlank()&&name.isNotBlank()&&loanType.isNotBlank()&&loanPaymentTotal(amount)?.signum()==1&&(loanDuration.isBlank()||loanDuration.toIntOrNull()?.let{it in 1..1200}==true)
        kind=="loan-payments"->source.isNotBlank()&&branch.isNotBlank()&&loanPaymentTotal(amount,interest,charges)?.signum()==1
        kind=="accounts"->name.isNotBlank()&&(type!="BANK"||bankErrors.valid)
        else->source.isNotBlank()&&amount.isNotBlank()&&branch.isNotBlank()&&(kind!="owners"||(owner.isNotBlank()&&fundingReturns!=null))
    }
    AlertDialog(onDismissRequest={if(!saving)close()},title={Text(if(kind=="loan-edit")"Edit loan details"else if(identity)"Owner / partner" else kind.replace('-',' ').replaceFirstChar{it.uppercase()})},text={
        LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
            if(kind=="loan-operations"){
                item{Text("Cancellation reverses an untouched receipt. Archiving requires zero posted principal and preserves history.")}
                item{PickText("Loan action",loanAction,if(loanArchived)listOf("RESTORE")else if(selected?.str("status")=="CANCELLED")listOf("ARCHIVE")else if(selected?.str("status")=="PAID_OFF")listOf("TOP_UP","ARCHIVE")else listOf("TOP_UP","CANCEL","ARCHIVE"),enabled=!saving){loanAction=it}}
                item{OutlinedTextField(date,{date=it},label={Text("Transaction date (YYYY-MM-DD)")},enabled=!saving)}
                if(loanAction=="TOP_UP"){
                    item{Pick("Receive into account",source,accounts,enabled=!saving){source=it}}
                    item{OutlinedTextField(amount,{amount=it},label={Text("Top-up amount")},enabled=!saving)}
                    item{OutlinedTextField(loanDescription,{loanDescription=it},label={Text("Description")},enabled=!saving)}
                }else item{OutlinedTextField(adjustmentReason,{adjustmentReason=it},label={Text("Reason")},enabled=!saving)}
            }else if(kind=="loan-edit"){
                item{OutlinedTextField(loanName,{loanName=it},label={Text("Loan name")},enabled=!saving)}
                item{OutlinedTextField(loanNumber,{loanNumber=it},label={Text("Loan account number")},enabled=!saving)}
                item{OutlinedTextField(loanDescription,{loanDescription=it},label={Text("Description")},enabled=!saving)}
                item{OutlinedTextField(loanDuration,{loanDuration=it},label={Text("Duration (months)")},enabled=!saving)}
            }else if(identity){
                item{OutlinedTextField(name,{name=it},label={Text("Owner / partner name")},enabled=!saving)}
                item{PickText("Type",type,listOf("OWNER","PARTNER"),enabled=!saving){type=it}}
                item{OutlinedTextField(phone,{phone=it},label={Text("Phone")},enabled=!saving)}
                item{OutlinedTextField(email,{email=it},label={Text("Email")},enabled=!saving)}
                item{OutlinedTextField(address,{address=it},label={Text("Address")},enabled=!saving)}
                if(kind=="owner-setup"){
                    item{Pick("App user (optional)",owner,data.array("users"),enabled=!saving){owner=it;fundingAmounts=emptyMap()};if(owner.isNotBlank())TextButton({owner=""},enabled=!saving){Text("Clear app user")}}
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
                if(type=="BANK"){
                    item{OutlinedTextField(bankName,{bankName=it},label={Text("Bank name")},isError=bankErrors.bankName!=null,supportingText={bankErrors.bankName?.let{Text(it)}},enabled=!saving)}
                    item{OutlinedTextField(accountHolder,{accountHolder=it},label={Text("Account holder name")},isError=bankErrors.holder!=null,supportingText={bankErrors.holder?.let{Text(it)}},enabled=!saving)}
                    item{OutlinedTextField(bankBranch,{bankBranch=it},label={Text("Bank branch name")},isError=bankErrors.branch!=null,supportingText={bankErrors.branch?.let{Text(it)}},enabled=!saving)}
                    item{OutlinedTextField(bankNumber,{bankNumber=it},label={Text("Masked account number")},enabled=!saving)}
                    item{OutlinedTextField(bankIfsc,{bankIfsc=it},label={Text("IFSC")},isError=bankErrors.ifsc!=null,supportingText={bankErrors.ifsc?.let{Text(it)}},enabled=!saving);Text("Use IFSC from your bank document. Only its format is checked.")}
                    item{OutlinedTextField(bankUpi,{bankUpi=it},label={Text("UPI ID")},isError=bankErrors.upi!=null,supportingText={bankErrors.upi?.let{Text(it)}},enabled=!saving)}
                    item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Print bank details on invoices");Switch(printBank,{printBank=it},enabled=!saving,modifier=Modifier.semantics{contentDescription="Print bank details on invoices"})}}
                    item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Print payment QR on invoices");Switch(printQr,{printQr=it},enabled=!saving,modifier=Modifier.semantics{contentDescription="Print payment QR on invoices"})}}
                }
                if(selected==null){
                    item{Pick("Branch (optional)",branch,data.array("branches"),enabled=!saving){branch=it}}
                    item{OutlinedTextField(amount,{amount=it},label={Text("Starting balance (optional)")},enabled=!saving)}
                    item{OutlinedTextField(date,{date=it},label={Text("As on date (YYYY-MM-DD)")},enabled=!saving)}
                    if(branch.isBlank())item{Pick("Opening journal branch",openingBranch,data.array("branches"),enabled=!saving){openingBranch=it}}
                    item{Text("A non-zero starting balance posts against Opening Balance Equity.")}
                }
            }else{
                item{if(kind=="loan-payments")Text("Loan branch: "+data.array("branches").firstOrNull{it.jsonObject.str("id")==branch}?.jsonObject?.str("name").orEmpty())else Pick("Branch",branch,data.array("branches"),enabled=!saving){branch=it;fundingAmounts=emptyMap();if(kind=="loans")source=""}}
                if(kind=="transfers"){
                    item{Text("Deposit / Withdraw");MoneyTransferMode.entries.forEach{mode->Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){RadioButton(selected=transferMode==mode,onClick={transferMode=mode;source="";destination=""},enabled=!saving);Text(mode.label)}}}
                    item{Pick("Source account",source,accounts.filter{transferModeAccepts(transferMode,it.jsonObject.str("type"),true)&&it.jsonObject.str("id")!=destination},enabled=!saving){source=it}}
                    item{Pick("Destination account",destination,accounts.filter{transferModeAccepts(transferMode,it.jsonObject.str("type"),false)&&it.jsonObject.str("id")!=source},enabled=!saving){destination=it}}
                    item{Text("To adjust a bank balance, open the bank account history and choose Add / Reduce with an offset ledger and reason.")}
                }else item{Pick("Money account",source,accounts,enabled=!saving){source=it}}
                if(kind=="owners"){
                    item{Pick("Owner / partner",owner,data.array("owners").filter{it.jsonObject["isActive"]?.jsonPrimitive?.booleanOrNull!=false},enabled=!saving){owner=it;fundingAmounts=emptyMap()}}
                    item{PickText("Transaction",type,listOf("INVESTMENT","CAPITAL_WITHDRAWAL","PROFIT_DISTRIBUTION")+if(data["capabilities"]?.jsonObject?.get("manageLoans")?.jsonPrimitive?.booleanOrNull==true)listOf("OWNER_LOAN")else emptyList(),enabled=!saving){type=it;fundingAmounts=emptyMap()}}
                }
                if(kind=="owners"&&type=="CAPITAL_WITHDRAWAL"){
                    data.array("owners").firstOrNull{it.jsonObject.str("id")==owner}?.jsonObject?.get("currentBalances")?.jsonObject?.let{balances->item{Text("Remaining posted capital: "+accountMoney(balances.str("capital")))}}
                    val funding=data.array("fundingRepayments").filter{it.jsonObject.str("ownerFinancialAccountId")==owner&&it.jsonObject.str("branchId")==branch}
                    if(funding.isNotEmpty())item{Text("Attribute capital returned to funded assets. Leave blank for unallocated capital.")}
                    items(funding){entry->val row=entry.jsonObject;val id=row.str("id");OutlinedTextField(fundingAmounts[id].orEmpty(),{fundingAmounts=fundingAmounts+(id to it)},label={Text(row.str("assetName")+" · remaining "+accountMoney(row.str("remainingAmount")))},enabled=!saving)}
                    if(fundingReturns==null&&amount.isNotBlank())item{Text("Enter positive amounts within the payment and remaining funding, with at most two decimal places.",color=MaterialTheme.colorScheme.error)}
                }
                if(kind=="loans"){
                    item{OutlinedTextField(loanName,{loanName=it},label={Text("Loan name")},enabled=!saving)}
                    item{OutlinedTextField(loanNumber,{loanNumber=it},label={Text("Loan account number")},enabled=!saving)}
                    item{OutlinedTextField(loanDescription,{loanDescription=it},label={Text("Description")},enabled=!saving)}
                    item{OutlinedTextField(loanDuration,{loanDuration=it},label={Text("Duration (months)")},isError=loanDuration.isNotBlank()&&loanDuration.toIntOrNull()?.let{it in 1..1200}!=true,supportingText={if(loanDuration.isNotBlank()&&loanDuration.toIntOrNull()?.let{it in 1..1200}!=true)Text("Enter whole months from 1 to 1200.")},enabled=!saving)}
                    item{OutlinedTextField(loanType,{loanType=it},label={Text("Loan type")},enabled=!saving)}
                    item{OutlinedTextField(name,{name=it},label={Text("Lender")},enabled=!saving)}
                    item{OutlinedTextField(interest,{interest=it},label={Text("Interest rate")},enabled=!saving)}
                }
                if(kind=="loan-payments"){
                    item{OutlinedTextField(interest,{interest=it},label={Text("Interest paid")},enabled=!saving)}
                    item{OutlinedTextField(charges,{charges=it},label={Text("Charges")},enabled=!saving)}
                    item{OutlinedTextField(paymentDescription,{paymentDescription=it},label={Text("Payment description")},enabled=!saving)}
                    item{Text("Payment total: "+(loanPaymentTotal(amount,interest,charges)?.let{accountMoney(it)}?:"Enter valid amounts"),modifier=Modifier.semantics{liveRegion=LiveRegionMode.Polite})}
                }
                item{OutlinedTextField(amount,{amount=it},label={Text(if(kind=="loan-payments")"Principal paid" else "Amount")},enabled=!saving)}
                item{OutlinedTextField(date,{date=it},label={Text("Date")},enabled=!saving)}
                if(kind=="transfers")item{TextButton(enabled=!saving&&!transferImageLoading,onClick={imagePicker.launch("image/*")}){Text(if(transferImageLoading)"Reading image…" else "Add image (optional)")};transferImage?.let{image->Text(image.str("name"));TextButton(enabled=!saving,onClick={transferImage=null}){Text("Remove image")}};transferImageError?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(enabled=!saving,onClick={transferImageError=null;transferImage=null}){Text("Remove image")}};Text("PNG, JPEG or WebP up to 5 MB.")}
                if(kind=="transfers")item{OutlinedTextField(transferDescription,{if(it.length<=2000)transferDescription=it},label={Text("Description")},enabled=!saving)}
                item{OutlinedTextField(reference,{reference=it},label={Text("Reference")},enabled=!saving)}
            }
            if(error!=null)item{Text(error,color=MaterialTheme.colorScheme.error,modifier=Modifier.semantics{liveRegion=LiveRegionMode.Polite})}
        }
    },confirmButton={Button(enabled=!saving&&valid,onClick={save(kind,buildJsonObject{
        when{
            kind=="loan-operations"->{put("requestKey",requestKey);put("expectedVersion",selected?.get("version")?.jsonPrimitive?.intOrNull?:0);put("action",loanAction);put("operationDate",date);if(loanAction=="TOP_UP"){put("amount",amount);put("moneyAccountId",source);put("description",loanDescription)}else put("reason",adjustmentReason)}
            kind=="loan-edit"->{put("requestKey",requestKey);put("expectedVersion",selected?.get("version")?.jsonPrimitive?.intOrNull?:0);put("displayName",loanName);put("loanAccountNumber",loanNumber);put("description",loanDescription);put("durationMonths",loanDuration)}
            identity->{put("name",name);put("partyType",type);put("phone",phone);put("email",email);put("address",address);if(kind=="owner-setup"){owner.takeIf{it.isNotBlank()}?.let{put("userId",it)};put("branchId",branch);put("creationRequestKey",requestKey)}else put("isActive",active)}
            kind=="adjustments"->{put("moneyAccountId",selected?.str("id").orEmpty());put("branchId",branch);put("direction",direction);put("offsetLedgerId",offsetLedger);put("amount",amount);put("date",date);put("reason",adjustmentReason);put("idempotencyKey",requestKey)}
            kind=="accounts"->{put("name",name);if(type=="BANK"){put("bankName",bankName);put("accountHolderName",accountHolder);put("bankBranchName",bankBranch);put("accountNumberMasked",bankNumber);put("ifsc",bankIfsc);put("upiId",bankUpi);put("printBankDetails",printBank);put("printUpiQr",printQr)};if(selected==null){put("type",type);branch.takeIf{it.isNotBlank()}?.let{put("branchId",it)};if(amount.isNotBlank()){put("openingBalance",amount);put("openingDate",date);if(branch.isBlank()&&openingBranch.isNotBlank())put("openingBranchId",openingBranch)}}}
            else->{put("branchId",branch);put("moneyAccountId",source);put("reference",reference);put("idempotencyKey",requestKey);when(kind){
                "transfers"->{transferImage?.let{put("image",it)};put("description",transferDescription);put("sourceAccountId",source);put("destinationAccountId",destination);put("transferDate",date);put("amount",amount)}
                "owners"->{if(type=="CAPITAL_WITHDRAWAL")put("fundingReturns",fundingReturns?:JsonArray(emptyList()));put("ownerFinancialAccountId",owner);put("type",type);put("transactionDate",date);put("amount",amount)}
                "loans"->{put("lender",name);put("loanType",loanType);put("displayName",loanName);put("loanAccountNumber",loanNumber);put("description",loanDescription);put("durationMonths",loanDuration);put("principal",amount);put("interestRate",interest);put("startDate",date)}
                "loan-payments"->{put("loanId",selected?.str("id").orEmpty());put("paymentDate",date);put("principal",amount);put("interest",interest);put("charges",charges);put("description",paymentDescription)}
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
