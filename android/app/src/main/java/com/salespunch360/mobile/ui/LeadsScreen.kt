@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.salespunch360.mobile.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.LeadsViewModel
import com.salespunch360.mobile.data.*
import java.math.BigDecimal
import java.math.RoundingMode

@Composable
fun LeadsScreen(initialLeadId:String?=null,onInitialLeadConsumed:()->Unit={},onCheckIn:(LeadSummary)->Unit={},onPendingVisitDetails:(PendingLeadVisit)->Unit={},vm:LeadsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 val context=LocalContext.current
 var selectedStage by remember{mutableStateOf<LeadStage?>(null)}
 var pendingView by remember{mutableStateOf(false)}
 var stageMenu by remember{mutableStateOf(false)}
 var employeeMenu by remember{mutableStateOf(false)}
 var followLead by remember{mutableStateOf<LeadSummary?>(null)}
 var transitionLead by remember{mutableStateOf<LeadSummary?>(null)}
 var deleteLead by remember{mutableStateOf<LeadSummary?>(null)}
 var phoneVisit by remember{mutableStateOf<PendingLeadVisit?>(null)}
 var editLead by remember{mutableStateOf<LeadSummary?>(null)}
 var callLead by remember{mutableStateOf<LeadSummary?>(null)}
 fun dial(lead:LeadSummary){val phone=lead.phone?.trim().orEmpty();if(phone.isBlank())return;callLead=lead;runCatching{context.startActivity(Intent(Intent.ACTION_DIAL,Uri.fromParts("tel",phone,null)))}}
 LaunchedEffect(initialLeadId){initialLeadId?.let{vm.open(it);onInitialLeadConsumed()}}
 if(state.detailLoading){LoadingScreen("Loading lead details…");return}
 state.detail?.let{lead->
  LeadDetails(lead,state.detailFollowUps,state.detailCallHistory,state.callCounts[lead.id]?:state.detailCallHistory.size,state.message,state.busy,{vm.clear()},{vm.close()},{dial(lead)},{onCheckIn(lead)},{editLead=lead},{deleteLead=lead})
  editLead?.let{target->EditLeadDialog(target,state.options,state.busy,{editLead=null}){vm.edit(it);editLead=null}}
  deleteLead?.let{target->DeleteLeadDialog(target,state.busy,{deleteLead=null}){vm.delete(target);deleteLead=null}}
  callLead?.let{target->CallResultDialog(target.title,state.busy,{callLead=null}){result,notes,callbackAt->callLead=null;vm.recordCall(target,result,notes,callbackAt)}}
  return
 }
 if(state.loading&&state.leads.isEmpty()){LoadingScreen("Loading leads…");return}
 val visible=state.leads.filter{selectedStage==null||it.stage==selectedStage}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{
   Text("Leads",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   HorizontalDivider(Modifier.padding(top=8.dp,bottom=8.dp),color=SalesLine)
   Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){OutlinedTextField(state.query,vm::setQuery,label={Text("Search name or phone")},singleLine=true,modifier=Modifier.weight(1f));Button({vm.refresh()},Modifier.padding(top=8.dp)){Text("Search")}}
   if(state.options.size>1){Box{OutlinedButton({employeeMenu=true},Modifier.fillMaxWidth()){Text(state.options.firstOrNull{it.id==state.employeeId}?.name?:"All Employees")};DropdownMenu(employeeMenu,{employeeMenu=false}){DropdownMenuItem({Text("All Employees")},{employeeMenu=false;vm.setEmployee(null);vm.refresh(employee=null)});state.options.forEach{u->DropdownMenuItem({Text("${u.name} · ${u.salesRole.name.replace('_',' ')}")},{employeeMenu=false;vm.setEmployee(u.id);vm.refresh(employee=u.id)})}}}}
   LazyRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){item{SummaryChip("All Leads",state.leads.size,!pendingView&&selectedStage==null){pendingView=false;selectedStage=null}};item{SummaryChip("Pending",state.pending.count,pendingView){pendingView=true}};items(LeadStage.entries){s->SummaryChip(stageLabel(s),state.leads.count{it.stage==s},!pendingView&&selectedStage==s){pendingView=false;selectedStage=s}}}
   if(!pendingView){Box{OutlinedButton({stageMenu=true},Modifier.fillMaxWidth()){Text(selectedStage?.let(::stageLabel)?:"All stages")};DropdownMenu(stageMenu,{stageMenu=false}){DropdownMenuItem({Text("All stages")},{selectedStage=null;stageMenu=false});LeadStage.entries.forEach{s->DropdownMenuItem({Text(stageLabel(s))},{selectedStage=s;stageMenu=false})}}}}
   state.message?.let{MessageBanner(it,vm::clear)}
  }
  if(pendingView){if(state.pending.visits.isEmpty())item{ContentCard("Pending","No check-ins are waiting for a phone number.")};items(state.pending.visits,key={"pending-${it.id}"}){visit->PendingVisitCard(visit,state.busy,{phoneVisit=visit}){onPendingVisitDetails(visit)}}}
  else{
   if(visible.isEmpty())item{ContentCard("No Leads","No leads match this filter.")}
   item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(selectedStage?.let(::stageLabel)?:"All Leads",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold);Text(visible.size.toString(),color=SalesMuted)}}
   items(visible,key={it.id}){lead->LeadCard(lead,state.callCounts[lead.id]?:0,state.busy,selectedStage==null,{vm.open(lead.id)},{followLead=lead},{dial(lead)},{onCheckIn(lead)},{transitionLead=lead})}
  }
 }
 followLead?.let{lead->FollowUpDialog(lead,state.telecallers,state.busy,{followLead=null}){date,notes,type,assignedId->vm.followUp(lead,date,notes,type,assignedId);followLead=null}}
 transitionLead?.let{lead->TransitionDialog(lead,state.busy,{transitionLead=null}){target,reason->vm.transition(lead,target,reason);transitionLead=null}}
 phoneVisit?.let{visit->PendingPhoneDialog(visit,state.busy,{phoneVisit=null}){phone->vm.addPendingPhone(visit,phone);phoneVisit=null}}
 callLead?.let{lead->CallResultDialog(lead.title,state.busy,{callLead=null}){result,notes,callbackAt->callLead=null;vm.recordCall(lead,result,notes,callbackAt)}}
}

@Composable
private fun LeadDetails(lead:LeadSummary,followUps:List<FollowUpTask>,callHistory:List<LeadCallHistoryItem>,callCount:Int,message:String?,busy:Boolean,clearMessage:()->Unit,back:()->Unit,call:()->Unit,checkIn:()->Unit,edit:()->Unit,delete:()->Unit){
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{TextButton(back,contentPadding=PaddingValues(0.dp)){Text("← Back")};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Lead Details",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);StatusChip(stageLabel(lead.stage))};Spacer(Modifier.height(4.dp));Text("Check-ins ${lead.visitCount}   |   Calls $callCount",style=MaterialTheme.typography.bodyMedium,fontWeight=FontWeight.SemiBold);message?.let{MessageBanner(it,clearMessage)}}
  item{OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text(lead.title,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);Text(lead.customer?.name?:lead.companyName?:"Prospect");Text("Assigned: ${lead.assignedUser.name}",color=SalesMuted);Text("Source: ${lead.source}",color=SalesMuted);lead.phone?.let{Text("Phone: $it",color=SalesMuted)};lead.email?.let{Text("Email: $it",color=SalesMuted)};lead.estimatedValue?.let{Text("Value: ${lead.currencyCode} ${money(it)}",color=SalesMuted)};lead.lostReason?.let{Text("Lost reason: $it",color=SalesMuted)};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(edit,enabled=!busy,modifier=Modifier.weight(1f)){Text("Edit Lead")};if(lead.canDelete)OutlinedButton(delete,enabled=!busy,modifier=Modifier.weight(1f),colors=ButtonDefaults.outlinedButtonColors(contentColor=MaterialTheme.colorScheme.error)){Text("Delete Lead")}};if(!lead.phone.isNullOrBlank())Button(call,enabled=!busy,modifier=Modifier.fillMaxWidth()){Text("Call")};if(lead.canAddCheckIn&&lead.stage !in listOf(LeadStage.WON,LeadStage.LOST))OutlinedButton(checkIn,Modifier.fillMaxWidth()){Text("+ Add Check-in")}}}}
  item{Text("Follow-up History",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
  if(followUps.isEmpty())item{Text("No follow-ups added for this lead.",color=SalesMuted)}else items(followUps,key={"follow-${it.id}"}){task->val isCall=task.lastAction.startsWith("Call");OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){Text("${if(isCall)"Call" else "Visit"} · ${task.status}",fontWeight=FontWeight.Bold);Text("Due ${task.dueDate.take(10)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);task.notes?.let{Text(it,style=MaterialTheme.typography.bodySmall)}}}}
  item{Text("Call History",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
  if(callHistory.isEmpty())item{Text("No saved call results for this lead.",color=SalesMuted)}else items(callHistory,key={"call-${it.id}"}){CallHistoryCard(it)}
  item{Text("Check-in History",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
  if(lead.visits.isEmpty())item{Text("No authorized check-ins recorded for this lead.",color=SalesMuted)}else items(lead.visits,key={"visit-${it.id}"}){v->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){Text("${v.userName} · ${if(v.checkedOutAt==null)"Pending" else "Completed"}",fontWeight=FontWeight.Bold);Text("In ${friendlyLeadDateTime(v.checkedInAt)}",style=MaterialTheme.typography.bodySmall);v.checkedOutAt?.let{Text("Out ${friendlyLeadDateTime(it)}",style=MaterialTheme.typography.bodySmall)};v.checkInAddress?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)};v.visitNotes?.let{Text(it,style=MaterialTheme.typography.bodySmall)}}}}
  item{Text("Activity",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
  if(lead.activities.isEmpty())item{Text("No activity recorded.",color=SalesMuted)}else items(lead.activities,key={"activity-${it.id}"}){a->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){Text(a.type.replace('_',' '),fontWeight=FontWeight.Bold);Text("${a.actorUser.name} · ${friendlyLeadDateTime(a.createdAt)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);if(a.fromStage!=null&&a.toStage!=null)Text("${stageLabel(a.fromStage)} → ${stageLabel(a.toStage)}",style=MaterialTheme.typography.bodySmall)}}}
 }
}

@Composable private fun EditLeadDialog(lead:LeadSummary,options:List<DashboardEmployee>,busy:Boolean,dismiss:()->Unit,save:(LeadEditRequest)->Unit){var title by remember{mutableStateOf(lead.title)};var company by remember{mutableStateOf(lead.companyName?:"")};var contact by remember{mutableStateOf(lead.contactName?:"")};var phone by remember{mutableStateOf(lead.phone?:"")};var email by remember{mutableStateOf(lead.email?:"")};var value by remember{mutableStateOf(lead.estimatedValue?:"")};var notes by remember{mutableStateOf(lead.notes?:"")};var assignee by remember{mutableStateOf(lead.assignedUserId)};var menu by remember{mutableStateOf(false)};AlertDialog(onDismissRequest=dismiss,title={Text("Edit Lead")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(7.dp)){OutlinedTextField(title,{title=it},label={Text("Title")});OutlinedTextField(company,{company=it},label={Text("Company / prospect")});OutlinedTextField(contact,{contact=it},label={Text("Contact name")});OutlinedTextField(phone,{phone=it},label={Text("Phone")});OutlinedTextField(email,{email=it},label={Text("Email")});OutlinedTextField(value,{value=it.filter{c->c.isDigit()||c=='.'}},label={Text("Estimated value")});if(options.isNotEmpty()){Box{OutlinedButton({menu=true},Modifier.fillMaxWidth()){Text(options.firstOrNull{it.id==assignee}?.name?:lead.assignedUser.name)};DropdownMenu(menu,{menu=false}){options.forEach{o->DropdownMenuItem({Text(o.name)},{assignee=o.id;menu=false})}}}};OutlinedTextField(notes,{notes=it.take(5000)},label={Text("Notes")},minLines=2)}},confirmButton={Button({save(LeadEditRequest(leadId=lead.id,title=title.trim(),companyName=company.ifBlank{null},contactName=contact.ifBlank{null},phone=phone.ifBlank{null},email=email.ifBlank{null},estimatedValue=value.ifBlank{null},currencyCode=lead.currencyCode,assignedUserId=assignee,notes=notes.ifBlank{null}))},enabled=!busy&&title.isNotBlank()){Text(if(busy)"Saving…" else "Save")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
@Composable private fun PendingVisitCard(visit:PendingLeadVisit,busy:Boolean,addPhone:()->Unit,details:()->Unit){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){Text(visit.contactName?:visit.customerName?:"Field prospect",fontWeight=FontWeight.Bold);Text("${visit.userName} · ${friendlyLeadDateTime(visit.checkedInAt)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text(if(visit.checkedOutAt!=null)"Checked out ${friendlyLeadDateTime(visit.checkedOutAt)}" else "Checkout pending",style=MaterialTheme.typography.bodySmall,color=SalesMuted);visit.visitNotes?.let{Text(it)};Text(visit.checkInAddress?:"%.5f, %.5f".format(visit.checkInLatitude,visit.checkInLongitude),style=MaterialTheme.typography.bodySmall,color=SalesMuted);if(visit.hasPhoto)TextButton(details){Text("View photo / details")};if(visit.canAddPhone)OutlinedButton(addPhone,enabled=!busy,modifier=Modifier.fillMaxWidth()){Text("Add phone to create Lead")}}}}
@Composable private fun PendingPhoneDialog(visit:PendingLeadVisit,busy:Boolean,dismiss:()->Unit,save:(String)->Unit){var phone by remember{mutableStateOf("")};AlertDialog(onDismissRequest=dismiss,title={Text("Add phone")},text={OutlinedTextField(phone,{phone=it},label={Text("Phone")})},confirmButton={Button({save(phone.trim())},enabled=!busy&&phone.isNotBlank()){Text("Add phone")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
@Composable private fun SummaryChip(label:String,count:Int,selected:Boolean,onClick:()->Unit){FilterChip(selected,onClick,{Column{Text(label,fontWeight=FontWeight.SemiBold);Text(count.toString(),style=MaterialTheme.typography.bodySmall)}})}
@Composable private fun LeadCard(lead:LeadSummary,calls:Int,busy:Boolean,showStage:Boolean,onDetails:()->Unit,onFollowUp:()->Unit,onCall:()->Unit,onCheckIn:()->Unit,onTransition:()->Unit){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){TextButton(onDetails,Modifier.weight(1f),contentPadding=PaddingValues(0.dp)){Text(lead.title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis)};if(!lead.phone.isNullOrBlank())Button(onCall,enabled=!busy,contentPadding=PaddingValues(horizontal=14.dp,vertical=8.dp)){Text("Call")}};if(showStage)StatusChip(stageLabel(lead.stage));Text(lead.customer?.name?:lead.companyName?:"Prospect");Text("${lead.assignedUser.name} · ${lead.source}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text("Check-ins ${lead.visitCount} | Calls $calls",style=MaterialTheme.typography.bodySmall,fontWeight=FontWeight.SemiBold);lead.estimatedValue?.let{Text("${lead.currencyCode} ${money(it)}",style=MaterialTheme.typography.bodySmall)};OutlinedButton(onFollowUp,enabled=!busy,modifier=Modifier.fillMaxWidth()){Text("+ Add Follow-up")};if(lead.canAddCheckIn)Button(onCheckIn,enabled=!busy&&lead.stage !in listOf(LeadStage.WON,LeadStage.LOST),modifier=Modifier.fillMaxWidth()){Text("+ Add Check-in")};if(lead.stage !in listOf(LeadStage.WON,LeadStage.LOST))OutlinedButton(onTransition,enabled=!busy,modifier=Modifier.fillMaxWidth()){Text("Choose next step...")}}}}
@Composable private fun DeleteLeadDialog(lead:LeadSummary,busy:Boolean,dismiss:()->Unit,confirm:()->Unit){AlertDialog(onDismissRequest=dismiss,title={Text("Delete this Lead?")},text={Text("This permanently deletes the Lead and related visit history/photos. This cannot be undone.")},confirmButton={Button(confirm,enabled=!busy,colors=ButtonDefaults.buttonColors(containerColor=MaterialTheme.colorScheme.error)){Text("Delete Permanently")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}

@Composable private fun FollowUpDialog(lead:LeadSummary,telecallers:List<TelecallerOption>,busy:Boolean,dismiss:()->Unit,save:(String,String?,String,String?)->Unit){
 var date by remember{mutableStateOf("")};var notes by remember{mutableStateOf("")};var type by remember{mutableStateOf("VISIT")};var assignTelecaller by remember{mutableStateOf(false)};var telecallerId by remember{mutableStateOf(telecallers.firstOrNull()?.id)};var menu by remember{mutableStateOf(false)}
 AlertDialog(onDismissRequest=dismiss,title={Text("Add Follow-up")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)){Text(lead.title,fontWeight=FontWeight.Bold);Text("Follow-up type",style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold);Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(type=="VISIT",{type="VISIT";assignTelecaller=false},{Text("Visit")});FilterChip(type=="CALL",{type="CALL"},{Text("Call")})};if(type=="CALL"){Text("Assign call to",fontWeight=FontWeight.SemiBold);Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(!assignTelecaller,{assignTelecaller=false},{Text("Myself")});FilterChip(assignTelecaller,{if(telecallers.isNotEmpty())assignTelecaller=true},{Text("Telecaller")},enabled=telecallers.isNotEmpty())};if(assignTelecaller){Box{OutlinedButton({menu=true},Modifier.fillMaxWidth()){Text(telecallers.firstOrNull{it.id==telecallerId}?.name?:"Choose Telecaller")};DropdownMenu(menu,{menu=false}){telecallers.forEach{t->DropdownMenuItem({Text(t.name)},{telecallerId=t.id;menu=false})}}}}else if(telecallers.isEmpty())Text("No active paid Telecaller available.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};OutlinedTextField(date,{date=it.take(10)},label={Text("Due date · YYYY-MM-DD")},modifier=Modifier.fillMaxWidth());OutlinedTextField(notes,{notes=it.take(1900)},label={Text("Notes (optional)")},modifier=Modifier.fillMaxWidth())}},confirmButton={Button({save(date,notes.ifBlank{null},type,if(type=="CALL"&&assignTelecaller)telecallerId else null)},enabled=!busy&&Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)&&(!assignTelecaller||telecallerId!=null)){Text(if(busy)"Adding…" else "Add Follow-up")}},dismissButton={TextButton(dismiss){Text("Cancel")}})
}
@Composable private fun TransitionDialog(lead:LeadSummary,busy:Boolean,dismiss:()->Unit,confirm:(LeadStage,String?)->Unit){var target by remember{mutableStateOf<LeadStage?>(null)};var lostReason by remember{mutableStateOf("")};AlertDialog(onDismissRequest=dismiss,title={Text("Choose next step...")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text("Current stage: ${stageLabel(lead.stage)}");FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){LeadStage.entries.filter{it!=lead.stage}.forEach{s->FilterChip(target==s,{target=s},{Text(stageLabel(s))})}};if(target==LeadStage.LOST)OutlinedTextField(lostReason,{lostReason=it},label={Text("Lost reason")})}},confirmButton={Button({target?.let{confirm(it,lostReason.ifBlank{null})}},enabled=!busy&&target!=null&&(target!=LeadStage.LOST||lostReason.isNotBlank())){Text("Confirm")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
private fun stageLabel(stage:LeadStage)=when(stage){LeadStage.NEW->"Lead";LeadStage.QUALIFIED->"Qualified";LeadStage.PROPOSAL->"Prospecting";LeadStage.NEGOTIATION->"Quote Given";LeadStage.WON->"Won";LeadStage.LOST->"Lost"}
private fun money(value:String)=runCatching{BigDecimal(value).setScale(2,RoundingMode.HALF_UP).toPlainString()}.getOrDefault(value)
private fun friendlyLeadDateTime(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.getOrElse{value}
