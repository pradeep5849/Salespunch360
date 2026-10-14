package com.salespunch360.mobile.ui.account.money

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.salespunch360.mobile.ChequeState
import com.salespunch360.mobile.ChequeViewModel
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.ui.account.sales.SelectField
import kotlinx.serialization.json.*
import java.util.UUID

@Composable
fun ChequeEntryDialog(state:ChequeState, vm:ChequeViewModel, legacy:JsonObject?, close:()->Unit, addAccount:()->Unit={}) {
    val requestKey=remember{UUID.randomUUID().toString()}
    var branch by remember{mutableStateOf(legacy?.str("branchId").orEmpty())}
    var direction by remember{mutableStateOf(legacy?.str("status") ?: "RECEIVED")}
    var bank by remember{mutableStateOf("")}
    var number by remember{mutableStateOf("")}
    var date by remember{mutableStateOf("")}
    var amount by remember{mutableStateOf(legacy?.get("amount")?.jsonPrimitive?.contentOrNull.orEmpty())}
    var query by remember{mutableStateOf("")}
    var party by remember{mutableStateOf("")}
    var partyOffset by remember{mutableIntStateOf(0)}
    var accountOffset by remember{mutableIntStateOf(0)}
    var reference by remember{mutableStateOf("")}
    LaunchedEffect(Unit){vm.clearParties()}
    LaunchedEffect(state.entryOptions.str("branchId")){if(legacy==null&&branch.isBlank())branch=state.entryOptions.str("branchId")}
    val branches=state.entryOptions.array("branches").map{it.jsonObject}.map{it.str("id") to it.str("name")}
    val accounts=state.entryOptions.array("accounts").map{it.jsonObject}.map{it.str("id") to it.str("name")}
    val valid=branch.isNotBlank()&&party.isNotBlank()&&amount.matches(Regex("\\d{1,16}(\\.\\d{1,2})?"))&&amount.toBigDecimalOrNull()?.signum()==1&&(legacy!=null||(bank.isNotBlank()&&number.isNotBlank()&&runCatching{java.time.LocalDate.parse(date)}.isSuccess))
    AlertDialog(onDismissRequest={if(!state.saving)close()},title={Text(if(legacy==null)"Record cheque" else "Complete source details")},
        text={Column(Modifier.verticalScroll(rememberScrollState())){
            if(legacy==null){
                ChequeSelect("Branch",branch,branches,!state.saving&&!state.optionsLoading){branch=it;bank="";party="";accountOffset=0;vm.clearParties();vm.entryOptions(it)}
                ChequeSelect("Direction",direction,listOf("RECEIVED" to "Received from customer","ISSUED" to "Issued to vendor"),!state.saving){direction=it;party="";vm.clearParties()}
                if(state.optionsLoading)LinearProgressIndicator()
                if(!state.optionsLoading&&accounts.isEmpty()&&accountOffset==0){Text("Add an active bank account before recording a cheque.");TextButton(addAccount){Text("Add bank account")};TextButton({vm.entryOptions(branch)}){Text("Retry accounts")}}
                ChequeSelect("Bank account",bank,accounts,!state.saving&&!state.optionsLoading){bank=it}
                if(accountOffset>0)TextButton({accountOffset=(accountOffset-25).coerceAtLeast(0);bank="";vm.entryOptions(branch,"BANK",accountOffset)},enabled=!state.optionsLoading&&!state.saving){Text("Previous accounts")}
                if(state.entryOptions["hasMore"]?.jsonPrimitive?.booleanOrNull==true)TextButton({accountOffset+=25;bank="";vm.entryOptions(branch,"BANK",accountOffset)},enabled=!state.optionsLoading&&!state.saving){Text("More accounts")}
                OutlinedTextField(number,{number=it.take(80)},label={Text("Cheque number")},enabled=!state.saving)
                OutlinedTextField(date,{date=it},label={Text("Cheque date (YYYY-MM-DD)")},enabled=!state.saving)
            }else Text("Original party: ${legacy.str("partyName")}. Confirm the original party and amount; payment stays pending until closure.")
            OutlinedTextField(query,{query=it.take(160)},label={Text("Search party")},enabled=!state.saving&&!state.partiesLoading)
            TextButton({partyOffset=0;party="";vm.parties(branch,direction,query)},enabled=!state.saving&&!state.partiesLoading&&branch.isNotBlank()){Text("Find parties")}
            if(state.partiesLoading)LinearProgressIndicator()
            ChequeSelect("Party",party,state.parties.map{it.str("id") to it.str("name")},!state.saving&&!state.partiesLoading){party=it}
            if(partyOffset>0)TextButton({partyOffset=(partyOffset-25).coerceAtLeast(0);party="";vm.parties(branch,direction,query,partyOffset)},enabled=!state.partiesLoading&&!state.saving){Text("Previous parties")}
            if(state.partiesMore)TextButton({partyOffset+=25;party="";vm.parties(branch,direction,query,partyOffset)},enabled=!state.partiesLoading&&!state.saving){Text("More parties")}
            OutlinedTextField(amount,{amount=it},label={Text("Amount")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),enabled=!state.saving)
            if(legacy==null)OutlinedTextField(reference,{reference=it.take(160)},label={Text("Reference")},enabled=!state.saving)
            Text("This cheque becomes an advance when closed. Invoice-linked cheques use the invoice payment flow.")
            state.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        }},
        confirmButton={TextButton({vm.record(buildJsonObject{
            put("requestKey",requestKey);put("partyId",party);put("amount",amount)
            if(legacy!=null)put("expectedVersion",legacy["actionVersion"]?.jsonPrimitive?.intOrNull?:0)
            else{put("branchId",branch);put("moneyAccountId",bank);put("chequeNumber",number.trim());put("chequeDate",date);put("status",direction);if(reference.isNotBlank())put("reference",reference)}
        },legacy?.str("id"),close)},enabled=valid&&!state.saving&&!state.optionsLoading&&!state.partiesLoading){Text(if(state.saving)"Saving…"else if(legacy==null)"Record cheque"else"Confirm source details")}},
        dismissButton={TextButton(close,enabled=!state.saving){Text("Cancel")}})
}

@Composable
internal fun ChequeSelect(label:String,value:String,choices:List<Pair<String,String>>,enabled:Boolean,onChange:(String)->Unit){
 if(enabled)SelectField(label,value,choices,onChange=onChange)
 else OutlinedTextField(choices.firstOrNull{it.first==value}?.second.orEmpty(),{},label={Text(label)},enabled=false,readOnly=true)
}
