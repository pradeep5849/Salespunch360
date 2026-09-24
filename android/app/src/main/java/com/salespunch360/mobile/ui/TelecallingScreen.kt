package com.salespunch360.mobile.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.TelecallingViewModel
import com.salespunch360.mobile.data.*
import java.time.*
import java.time.format.DateTimeFormatter

@Composable
fun TelecallingScreen(vm: TelecallingViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var pendingCall by remember { mutableStateOf<TelecallingLead?>(null) }
    var pendingTaskId by remember { mutableStateOf<String?>(null) }
    var dialStartedAt by remember { mutableStateOf<String?>(null) }
    var dialEndedAt by remember { mutableStateOf<String?>(null) }
    var dialLeftApp by remember { mutableStateOf(false) }

    fun clearPendingCall() {
        pendingCall = null
        pendingTaskId = null
        dialStartedAt = null
        dialEndedAt = null
        dialLeftApp = false
    }

    fun dial(lead: TelecallingLead,taskId:String?=null) {
        val phone = lead.phone?.trim().orEmpty();if (phone.isBlank()) return
        pendingCall = lead;pendingTaskId=taskId
        dialStartedAt=Instant.now().toString();dialEndedAt=null;dialLeftApp=false
        val launched=runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", phone, null))) }.isSuccess
        if(!launched)clearPendingCall()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when(event) {
                Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> if(dialStartedAt!=null) dialLeftApp=true
                Lifecycle.Event.ON_RESUME -> if(dialStartedAt!=null&&dialLeftApp&&dialEndedAt==null) dialEndedAt=Instant.now().toString()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    state.historyLead?.let { lead ->
        TelecallingHistoryScreen(lead,state.history,state.busy,state.message,vm::clearMessage,vm::closeHistory,{ dial(lead) })
        pendingCall?.let { target ->
            CallResultDialog(target.title,state.busy,::clearPendingCall,dialDurationSeconds(dialStartedAt,dialEndedAt)){result,notes,callbackAt->
                val task=pendingTaskId;val started=dialStartedAt;val ended=dialEndedAt;clearPendingCall()
                vm.recordCall(target,result,notes,callbackAt,task,started,ended,if(started!=null&&ended!=null)"ANDROID_RESUME" else null)
            }
        }
        return
    }

    if (state.loading && state.callbacks.isEmpty() && !state.searched) { LoadingScreen("Loading telecalling queue…");return }
    val groups=listOf("Overdue","Today","Upcoming").associateWith{bucket->state.callbacks.filter{callbackBucket(it)==bucket}}

    LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        item {
            Text("Telecalling", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = SalesInk)
            Text("Scheduled calls first. Search a company lead only when you need it.", color = SalesMuted)
            HorizontalDivider(Modifier.padding(top=8.dp,bottom=8.dp),color=SalesLine)
            state.message?.let { MessageBanner(it, vm::clearMessage) }
        }
        groups.forEach{(title,callbacks)->
            item(key="heading-$title"){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);Text(callbacks.size.toString(),color=SalesMuted)}}
            if(callbacks.isEmpty())item(key="empty-$title"){ContentCard(title,"No calls.")}
            else items(callbacks,key={"callback-${it.id}"}){callback->
                val lead=state.queue.firstOrNull{it.id==callback.leadId}?:TelecallingLead(callback.leadId,callback.leadTitle,phone=callback.phone,stage="CALL_BACK",assignedUserId=callback.callbackAssigneeUserId?:"",ownerName=callback.ownerName)
                CallbackCard(callback,state.busy,{dial(lead,callback.followUpTaskId)},{vm.openHistory(lead)})
            }
        }
        item {
            Spacer(Modifier.height(4.dp));Text("Find a Lead",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
            Text("Search lead, contact or mobile. All company leads are not shown by default.",color=SalesMuted,style=MaterialTheme.typography.bodySmall)
            Row(Modifier.padding(top=8.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedTextField(state.query,vm::setQuery,label={Text("Search lead or phone")},singleLine=true,modifier=Modifier.weight(1f));Button(vm::search,Modifier.padding(top=8.dp)){Text("Search")}}
        }
        if(!state.searched)item{ContentCard("Search","Enter a lead, contact or mobile number to find company leads.")}
        else if(state.queue.isEmpty())item{ContentCard("Search Results","No leads match this search.")}
        else{
            item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Search Results",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);Text(state.queue.size.toString(),color=SalesMuted)}}
            items(state.queue,key={it.id}){lead->TelecallingLeadCard(lead,state.busy,{dial(lead)},{vm.openHistory(lead)})}
        }
    }

    pendingCall?.let { lead ->
        CallResultDialog(lead.title,state.busy,::clearPendingCall,dialDurationSeconds(dialStartedAt,dialEndedAt)){result,notes,callbackAt->
            val task=pendingTaskId;val started=dialStartedAt;val ended=dialEndedAt;clearPendingCall()
            vm.recordCall(lead,result,notes,callbackAt,task,started,ended,if(started!=null&&ended!=null)"ANDROID_RESUME" else null)
        }
    }
}

@Composable
private fun TelecallingLeadCard(lead: TelecallingLead, busy: Boolean, onCall: () -> Unit, onHistory: () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(lead.title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis,modifier=Modifier.weight(1f));StatusChip(lead.stage.replace('_',' '))}
        lead.contactName?.let{Text(it,color=SalesMuted)};Text("Owner: ${lead.ownerName}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text("Calls ${lead.calls}",style=MaterialTheme.typography.bodySmall,fontWeight=FontWeight.SemiBold);lead.phone?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
        Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){Button(onCall,enabled=!busy&&!lead.phone.isNullOrBlank(),modifier=Modifier.weight(1f)){Text("Call")};OutlinedButton(onHistory,enabled=!busy,modifier=Modifier.weight(1f)){Text("History")}}
    }}
}

@Composable
private fun CallbackCard(callback:CallbackQueueItem,busy:Boolean,onCall:()->Unit,onHistory:()->Unit){
 OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(callback.leadTitle,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));StatusChip(callbackBucket(callback))}
  Text("Owner: ${callback.ownerName}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);callback.assigneeName?.let{Text("Assigned: $it",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Text("Due: ${friendlyCallTime(callback.nextCallbackAt)}",style=MaterialTheme.typography.bodySmall);callback.phone?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)};callback.notes?.let{Text(it,style=MaterialTheme.typography.bodySmall)}
  Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){Button(onCall,enabled=!busy&&!callback.phone.isNullOrBlank(),modifier=Modifier.weight(1f)){Text("Call")};OutlinedButton(onHistory,enabled=!busy,modifier=Modifier.weight(1f)){Text("History")}}
 }}
}

@Composable
private fun TelecallingHistoryScreen(lead:TelecallingLead,history:List<LeadCallHistoryItem>,busy:Boolean,message:String?,clearMessage:()->Unit,back:()->Unit,call:()->Unit){LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){item{TextButton(back,contentPadding=PaddingValues(0.dp)){Text("← Back")};Text("Call History",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);Text(lead.title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);Text("Owner: ${lead.ownerName} · Calls ${lead.calls}",color=SalesMuted);lead.phone?.let{Text(it,color=SalesMuted)};Button(call,enabled=!busy&&!lead.phone.isNullOrBlank(),modifier=Modifier.fillMaxWidth().padding(top=6.dp)){Text("Call")};message?.let{MessageBanner(it,clearMessage)}};if(history.isEmpty())item{ContentCard("History","No saved call results for this lead.")}else items(history,key={it.id}){CallHistoryCard(it)}}}

@Composable internal fun CallHistoryCard(item:LeadCallHistoryItem){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){Text(telecallingResultLabel(item.result),fontWeight=FontWeight.Bold);Text("${item.callerName} · ${friendlyCallTime(item.calledAt)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);item.dialDurationSeconds?.let{Text("Dial session: ${formatDialDuration(it)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};item.notes?.let{Text(it,style=MaterialTheme.typography.bodySmall)};item.nextCallbackAt?.let{Text("Next callback: ${friendlyCallTime(it)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}}}

@Composable
internal fun CallResultDialog(leadTitle:String,busy:Boolean,dismiss:()->Unit,dialSeconds:Int?=null,save:(result:String,notes:String?,nextCallbackAt:String?)->Unit){var result by remember{mutableStateOf("CONNECTED")};var resultMenu by remember{mutableStateOf(false)};var notes by remember{mutableStateOf("")};var callbackText by remember{mutableStateOf(LocalDateTime.now(ZoneId.of("Asia/Kolkata")).plusDays(1).withSecond(0).withNano(0).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))};val callbackIsoValue=if(result=="CALL_BACK")parseCallbackIso(callbackText) else null;AlertDialog(onDismissRequest=dismiss,title={Text("Save call result")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){Text(leadTitle,fontWeight=FontWeight.Bold);Text(if(dialSeconds!=null)"Dial session captured: ${formatDialDuration(dialSeconds)}. Select the call result below." else "The call is counted only after you save a result.",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Box{OutlinedButton({resultMenu=true},Modifier.fillMaxWidth()){Text(telecallingResultLabel(result))};DropdownMenu(resultMenu,{resultMenu=false}){TELECALLING_RESULT_OPTIONS.forEach{(value,label)->DropdownMenuItem({Text(label)},{result=value;resultMenu=false})}}};OutlinedTextField(notes,{notes=it.take(2000)},label={Text("Notes")},minLines=2,modifier=Modifier.fillMaxWidth());if(result=="CALL_BACK")OutlinedTextField(callbackText,{callbackText=it.take(16)},label={Text("Callback date & time")},supportingText={Text("Format: YYYY-MM-DD HH:MM")},isError=callbackIsoValue==null,modifier=Modifier.fillMaxWidth())}},confirmButton={Button({save(result,notes.trim().ifBlank{null},callbackIsoValue)},enabled=!busy&&(result!="CALL_BACK"||callbackIsoValue!=null)){Text(if(busy)"Saving…" else "Save")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}

private fun dialDurationSeconds(start:String?,end:String?):Int?{if(start.isNullOrBlank()||end.isNullOrBlank())return null;return runCatching{((Duration.between(Instant.parse(start),Instant.parse(end)).seconds).coerceIn(0,86400)).toInt()}.getOrNull()}
private fun formatDialDuration(seconds:Int):String{val minutes=seconds/60;val remainder=seconds%60;return if(minutes>0)"${minutes}m ${remainder}s" else "${remainder}s"}
private fun callbackBucket(item:CallbackQueueItem):String{val zone=ZoneId.of("Asia/Kolkata");val now=ZonedDateTime.now(zone);val due=parseCallTime(item.nextCallbackAt)?.withZoneSameInstant(zone)?:return "Upcoming";return when{due.isBefore(now)->"Overdue";due.toLocalDate()==now.toLocalDate()->"Today";else->"Upcoming"}}
private fun parseCallTime(value:String?):ZonedDateTime?{if(value.isNullOrBlank())return null;return runCatching{Instant.parse(value).atZone(ZoneId.of("UTC"))}.recoverCatching{OffsetDateTime.parse(value).toZonedDateTime()}.getOrNull()}
private fun parseCallbackIso(value:String):String?=runCatching{LocalDateTime.parse(value.trim(),DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")).atZone(ZoneId.of("Asia/Kolkata")).toInstant().toString()}.getOrNull()
private fun friendlyCallTime(value:String?):String{if(value.isNullOrBlank())return "—";return runCatching{Instant.parse(value).atZone(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.recoverCatching{OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.getOrDefault(value)}
