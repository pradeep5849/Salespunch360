package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.TargetsViewModel
import com.salespunch360.mobile.data.*

@Composable fun TargetsScreen(role:MobileRole,vm:TargetsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 if(role==MobileRole.SALES){
  LaunchedEffect(Unit){vm.loadMonthly()}
  val monthly=state.monthly
  if(state.loading&&monthly==null){LoadingScreen("Loading targets…");return}
  if(monthly==null){RetryScreen(state.message?:"Targets unavailable.",vm::loadMonthly);return}
  LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
   item{Text("Sales Targets",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);Text("Monthly targets run from the 1st to the last day of the month. Target numbers carry forward automatically; Created and Won actuals restart each month.",color=SalesMuted)}
   if(monthly.rows.isEmpty())item{OutlinedCard(Modifier.fillMaxWidth()){Text("No active field employees are visible in your current scope.",Modifier.padding(18.dp),color=SalesMuted)}}
   items(monthly.rows,key={it.id}){row->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text(row.name,fontWeight=FontWeight.Bold,color=SalesInk);Text(salesTargetRole(row),style=MaterialTheme.typography.bodySmall,color=SalesMuted);Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){TargetValue("Leads · Target / Created","${row.leadTarget} / ${row.created}",Modifier.weight(1f));TargetValue("Won · Target / Won","${row.wonTarget} / ${row.won}",Modifier.weight(1f))}}}}
  };return
 }
 val r=state.context;if(state.loading&&r==null){LoadingScreen("Loading targets…");return};if(r==null){RetryScreen(state.message?:"Targets unavailable.",vm::load);return};LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text("Targets",style=MaterialTheme.typography.headlineSmall)};if(r.options.isNotEmpty())item{TargetEditor(r.options,null,state.saving){vm.create(it)}};state.message?.let{item{ContentCard("Status",it)}};if(r.targets.isEmpty())item{ContentCard("No targets","No targets are visible in your authorized employee scope.")};items(r.targets,key={it.id}){t->ContentCard(t.assignedUser.name,"${t.metric.replace('_',' ')} · ${t.periodType}"){LinearProgressIndicator({(t.percentage/100).coerceIn(0.0,1.0).toFloat()},Modifier.fillMaxWidth());Text("${t.actual} of ${t.targetValue} ${t.currencyCode} · ${t.percentage}%");Text("${t.startDate.take(10)} – ${t.endDate.take(10)}");StatusChip(t.status.replace('_',' '));var edit by remember(t.id){mutableStateOf(false)};OutlinedButton({edit=!edit}){Text(if(edit)"Cancel edit" else "Edit target")};if(edit)TargetEditor(r.options,t,state.saving){request->vm.edit(EditTargetRequest(t.id,t.version,request.assignedUserId,request.metric,request.periodType,request.startDate,request.endDate,request.targetValue,request.currencyCode))}}}}}
}
@Composable private fun TargetValue(label:String,value:String,modifier:Modifier){Surface(modifier=modifier,color=SalesPale,shape=MaterialTheme.shapes.medium){Column(Modifier.padding(12.dp)){Text(label,style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(value,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}}}
private fun salesTargetRole(row:MonthlyTargetRow)=when(row.salesRole){MobileRole.SALES->"Sales";MobileRole.MANAGER->if(row.managerType=="MANAGER_ONLY")"Manager Only" else "Field Manager";MobileRole.PRIMARY_ADMIN->"Primary Admin";MobileRole.ADMIN->"Admin"}
@Composable private fun TargetEditor(options:List<TargetOption>,target:SalesTarget?,saving:Boolean,submit:(TargetRequest)->Unit){val initial=options.indexOfFirst{it.id==target?.assignedUserId}.coerceAtLeast(0);var option by remember(target?.id,options){mutableIntStateOf(initial)};var metric by remember(target?.id){mutableStateOf(target?.metric?:"WON_LEADS_COUNT")};var period by remember(target?.id){mutableStateOf(target?.periodType?:"CUSTOM")};var start by remember(target?.id){mutableStateOf(target?.startDate?.take(10)?:"")};var end by remember(target?.id){mutableStateOf(target?.endDate?.take(10)?:"")};var value by remember(target?.id){mutableStateOf(target?.targetValue?:"")};Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(8.dp)){if(target==null)Text("Create target",style=MaterialTheme.typography.titleMedium);TextButton({option=(option+1)%options.size}){Text("Employee: ${options[option].name} · ${options[option].role}")};TextButton({metric=if(metric=="WON_LEADS_COUNT")"WON_LEADS_VALUE" else "WON_LEADS_COUNT"}){Text("Metric: ${metric.replace('_',' ')}")};TextButton({val periods=listOf("CUSTOM","MONTHLY","QUARTERLY");period=periods[(periods.indexOf(period)+1)%periods.size]}){Text("Period: $period")};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){DateField("Start",start,{start=it},Modifier.weight(1f));DateField("End",end,{end=it},Modifier.weight(1f))};OutlinedTextField(value,{value=it},label={Text("Goal value")},singleLine=true,modifier=Modifier.fillMaxWidth());Button({submit(TargetRequest(options[option].id,metric,period,start,end,value))},enabled=!saving&&start.isNotBlank()&&end.isNotBlank()&&value.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text(if(saving)"Saving…" else if(target==null)"Create target" else "Save target")}}}
