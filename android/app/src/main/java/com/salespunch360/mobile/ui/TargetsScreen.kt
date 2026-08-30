package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.TargetsViewModel
import com.salespunch360.mobile.data.*

@Composable fun TargetsScreen(role:MobileRole,vm:TargetsViewModel=viewModel()){val state=vm.state.collectAsStateWithLifecycle().value;val r=state.context;if(state.loading&&r==null){LoadingScreen("Loading targets…");return};if(r==null){RetryScreen(state.message?:"Targets unavailable.",vm::load);return};LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text(if(role==MobileRole.SALES)"My targets" else "Targets",style=MaterialTheme.typography.headlineSmall);Text("Achievement and status are calculated by the server using Won leads and India business dates.")};if(role!=MobileRole.SALES&&r.options.isNotEmpty())item{NewTargetForm(r.options,state.saving,vm::create)};state.message?.let{item{ContentCard("Status",it)}};if(r.targets.isEmpty())item{ContentCard("No targets","No targets are visible in your authorized employee scope.")};items(r.targets){t->ContentCard(t.assignedUser.name,"${t.metric.replace('_',' ')} · ${t.periodType}"){LinearProgressIndicator({(t.percentage/100).coerceIn(0.0,1.0).toFloat()},Modifier.fillMaxWidth());Text("${t.actual} of ${t.targetValue} ${t.currencyCode} · ${t.percentage}%");Text("${t.startDate.take(10)} – ${t.endDate.take(10)}");StatusChip(t.status.replace('_',' '));if(role!=MobileRole.SALES)EditTargetValue(t,state.saving){vm.edit(t,it)}}}}}

@Composable private fun NewTargetForm(options:List<TargetOption>,saving:Boolean,submit:(TargetRequest)->Unit){var option by remember(options){mutableIntStateOf(0)};var metric by remember{mutableStateOf("WON_LEADS_COUNT")};var period by remember{mutableStateOf("CUSTOM")};var start by remember{mutableStateOf("")};var end by remember{mutableStateOf("")};var value by remember{mutableStateOf("")};ContentCard("Create target","Assign within your server-authorized employee scope."){TextButton({option=(option+1)%options.size}){Text("Employee: ${options[option].name} · ${options[option].role}")};TextButton({metric=if(metric=="WON_LEADS_COUNT")"WON_LEADS_VALUE" else "WON_LEADS_COUNT"}){Text("Metric: ${metric.replace('_',' ')}")};TextButton({period=listOf("CUSTOM","MONTHLY","QUARTERLY")[(listOf("CUSTOM","MONTHLY","QUARTERLY").indexOf(period)+1)%3]}){Text("Period: $period")};OutlinedTextField(start,{start=it},label={Text("Start YYYY-MM-DD")},modifier=Modifier.fillMaxWidth());OutlinedTextField(end,{end=it},label={Text("End YYYY-MM-DD")},modifier=Modifier.fillMaxWidth());OutlinedTextField(value,{value=it},label={Text("Goal value")},modifier=Modifier.fillMaxWidth());Button({submit(TargetRequest(options[option].id,metric,period,start,end,value))},enabled=!saving&&start.isNotBlank()&&end.isNotBlank()&&value.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text(if(saving)"Saving…" else "Create target")}}
}

@Composable private fun EditTargetValue(target:SalesTarget,saving:Boolean,save:(String)->Unit){var expanded by remember{mutableStateOf(false)};var value by remember(target){mutableStateOf(target.targetValue)};OutlinedButton({expanded=!expanded}){Text(if(expanded)"Cancel edit" else "Edit goal")};if(expanded){OutlinedTextField(value,{value=it},label={Text("Goal value")},modifier=Modifier.fillMaxWidth());Button({save(value)},enabled=!saving&&value.isNotBlank()){Text(if(saving)"Saving…" else "Update target")}}}
