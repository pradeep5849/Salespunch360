@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.LeadsViewModel
import com.salespunch360.mobile.data.*

@Composable fun LeadsScreen(initialLeadId:String?=null,onInitialLeadConsumed:()->Unit={},onCheckIn:(LeadSummary)->Unit={},vm:LeadsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;var search by remember{mutableStateOf("")};var stage by remember{mutableStateOf<LeadStage?>(null)};var followLead by remember{mutableStateOf<LeadSummary?>(null)};var transitionLead by remember{mutableStateOf<LeadSummary?>(null)};var deleteLead by remember{mutableStateOf<LeadSummary?>(null)}
 LaunchedEffect(initialLeadId,state.leads){initialLeadId?.let{id->state.leads.firstOrNull{it.id==id}?.let{followLead=it;onInitialLeadConsumed()}}}
 if(state.loading&&state.leads.isEmpty()){LoadingScreen("Loading leads…");return}
 val visible=state.leads.filter{stage==null||it.stage==stage}.filter{it.title.contains(search,true)||it.companyName?.contains(search,true)==true||it.customer?.name?.contains(search,true)==true||it.contactName?.contains(search,true)==true}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Leads",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);Spacer(Modifier.height(8.dp));OutlinedTextField(search,{search=it},Modifier.fillMaxWidth(),placeholder={Text("Search name or phone")},singleLine=true,leadingIcon={Icon(Icons.Default.Search,null)});Spacer(Modifier.height(8.dp));LazyRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){item{FilterChip(stage==null,{stage=null},{Text("All Leads ${state.leads.size}")})};items(LeadStage.entries){s->val count=state.leads.count{it.stage==s};FilterChip(stage==s,{stage=s},{Text("${stageLabel(s)} $count")})}};state.message?.let{MessageBanner(it,vm::clear)}}
  if(visible.isEmpty())item{ContentCard("No leads found","Try another search or pipeline filter.")}
  items(visible,key={it.id}){lead->LeadCard(lead,state.busy,onFollowUp={followLead=lead},onCheckIn={onCheckIn(lead)},onTransition={transitionLead=lead},onDelete={deleteLead=lead})}
 }
 followLead?.let{lead->FollowUpDialog(lead,state.busy,{followLead=null}){at,notes->vm.followUp(lead,at,notes);followLead=null}}
 transitionLead?.let{lead->TransitionDialog(lead,state.busy,{transitionLead=null}){target,reason->vm.transition(lead,target,reason);transitionLead=null}}
 deleteLead?.let{lead->DeleteLeadDialog(lead,state.busy,{deleteLead=null}){vm.delete(lead);deleteLead=null}}
}
@Composable private fun LeadCard(lead:LeadSummary,busy:Boolean,onFollowUp:()->Unit,onCheckIn:()->Unit,onTransition:()->Unit,onDelete:()->Unit){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Row{Text(lead.title,Modifier.weight(1f),style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis);StatusChip(stageLabel(lead.stage))};Text(lead.customer?.name?:lead.companyName?:lead.contactName?:"Prospect",color=SalesInk);lead.phone?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Text("${lead.assignedUser.name} · ${lead.source}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text("${lead.visitCount} check-in / visit${if(lead.visitCount==1)"" else "s"}",style=MaterialTheme.typography.bodySmall,fontWeight=FontWeight.SemiBold,color=SalesMuted);lead.followUpAt?.let{Text("Next follow-up ${friendlyLeadDate(it)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton(onFollowUp,enabled=!busy,modifier=Modifier.weight(1f)){Text("+ Add Follow-up")};Button(onCheckIn,enabled=!busy&&lead.stage !in listOf(LeadStage.WON,LeadStage.LOST),modifier=Modifier.weight(1f)){Text("+ Add Check-in")}};OutlinedButton(onDelete,enabled=!busy,modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.outlinedButtonColors(contentColor=MaterialTheme.colorScheme.error)){Text("Delete Lead")};OutlinedButton(onTransition,enabled=!busy&&lead.stage !in listOf(LeadStage.WON,LeadStage.LOST),modifier=Modifier.fillMaxWidth()){Text("Choose next step...")}}}}
@Composable private fun DeleteLeadDialog(lead:LeadSummary,busy:Boolean,dismiss:()->Unit,confirm:()->Unit){AlertDialog(onDismissRequest=dismiss,title={Text("Delete this Lead?")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text("This will permanently delete this Lead and all check-ins, visit history and stored photos related to this Lead.");Text("This action cannot be undone.",fontWeight=FontWeight.Bold)}},confirmButton={Button(confirm,enabled=!busy,colors=ButtonDefaults.buttonColors(containerColor=MaterialTheme.colorScheme.error)){Text("Delete Permanently")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
@Composable private fun FollowUpDialog(lead:LeadSummary,busy:Boolean,dismiss:()->Unit,save:(String?,String?)->Unit){var date by remember{mutableStateOf("")};var notes by remember{mutableStateOf("")};AlertDialog(onDismissRequest=dismiss,title={Text("Add Follow-up")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text(lead.title,fontWeight=FontWeight.Bold);OutlinedTextField(date,{date=it},label={Text("Due date · YYYY-MM-DD")},singleLine=true);OutlinedTextField(notes,{if(it.length<=5000)notes=it},label={Text("Notes (optional)")},minLines=2)}},confirmButton={Button({save(if(date.isBlank())null else "${date}T09:00:00+05:30",notes.ifBlank{null})},enabled=!busy&&Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)){Text("Add Follow-up")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
@Composable private fun TransitionDialog(lead:LeadSummary,busy:Boolean,dismiss:()->Unit,confirm:(LeadStage,String?)->Unit){var target by remember{mutableStateOf<LeadStage?>(null)};var lostReason by remember{mutableStateOf("")};AlertDialog(onDismissRequest=dismiss,title={Text("Choose next step...")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text("Current stage: ${stageLabel(lead.stage)}");FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){LeadStage.entries.filter{it!=lead.stage}.forEach{s->FilterChip(target==s,{target=s},{Text(stageLabel(s))})}};if(target==LeadStage.LOST)OutlinedTextField(lostReason,{lostReason=it},label={Text("Lost reason")})}},confirmButton={Button({target?.let{confirm(it,lostReason.ifBlank{null})}},enabled=!busy&&target!=null&&(target!=LeadStage.LOST||lostReason.isNotBlank())){Text("Confirm")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
private fun stageLabel(stage:LeadStage)=when(stage){LeadStage.NEW->"Lead";LeadStage.QUALIFIED->"Qualified";LeadStage.PROPOSAL->"Prospecting";LeadStage.NEGOTIATION->"Quote Given";LeadStage.WON->"Won";LeadStage.LOST->"Lost"}
private fun friendlyLeadDate(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy"))}.getOrElse{value.take(10)}
