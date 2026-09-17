package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.FollowUpsViewModel
import com.salespunch360.mobile.data.FollowUpTask

@Composable fun FollowUpsScreen(startCheckIn:(FollowUpTask)->Unit,viewLead:(String)->Unit,vm:FollowUpsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Text("Follow-ups",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);Spacer(Modifier.height(8.dp));LazyRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){items(listOf("TODAY" to "Due Today","OVERDUE" to "Overdue","PENDING" to "Pending","COMPLETED" to "Completed","CANCELLED" to "Cancelled")){(value,label)->FilterChip(state.filter==value,{vm.select(value)},{Text(label)})}}}
  state.message?.let{item{MessageBanner(it,vm::clear)}}
  if(state.loading&&state.tasks.isEmpty())item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  if(!state.loading&&state.tasks.isEmpty())item{OutlinedCard(Modifier.fillMaxWidth()){Box(Modifier.fillMaxWidth().padding(vertical=28.dp,horizontal=16.dp)){Text("No tasks in this view.",color=SalesMuted)}}}
  items(state.tasks,key={it.id}){task->FollowUpTaskCard(task,startCheckIn,viewLead)}
 }
}

@Composable private fun FollowUpTaskCard(task:FollowUpTask,startCheckIn:(FollowUpTask)->Unit,viewLead:(String)->Unit){
 OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
  Row{Column(Modifier.weight(1f)){Text(task.subjectName,fontWeight=FontWeight.Bold,color=SalesInk);Text(task.leadTitle,style=MaterialTheme.typography.bodySmall,color=SalesMuted)};StatusChip(task.status)}
  Text("Due ${task.dueDate.take(10)}",style=MaterialTheme.typography.labelMedium,color=SalesMuted);task.notes?.takeIf{it.isNotBlank()}?.let{Text(it,style=MaterialTheme.typography.bodyMedium)}
  if(task.completedVisitId!=null)Text(if(task.checkedOutAt!=null)"Follow-up visit completed" else "Follow-up check-in started",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton({viewLead(task.leadId)}){Text("View Lead")};if(task.canStartCheckIn)Button({startCheckIn(task)}){Text("Start Check-in")}}
 }}
}
