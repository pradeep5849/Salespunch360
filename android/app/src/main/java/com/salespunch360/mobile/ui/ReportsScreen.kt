@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
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
import com.salespunch360.mobile.ReportsViewModel
import kotlinx.serialization.json.*

private val salesReportTypes=listOf(
 "check-ins" to "Check-in Report",
 "attendance" to "My Attendance",
 "gps" to "My Travel / Distance",
 "targets" to "My Performance"
)

@Composable fun ReportsScreen(vm:ReportsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 var expanded by remember{mutableStateOf(true)}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Text("Reports",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);OutlinedButton({expanded=!expanded},Modifier.fillMaxWidth()){Text(if(expanded)"Reports ▲" else "Reports ▼")};if(expanded)Column(verticalArrangement=Arrangement.spacedBy(4.dp)){salesReportTypes.forEach{item->TextButton({vm.load(item.first)},Modifier.fillMaxWidth()){Text(item.second,Modifier.fillMaxWidth())}}}}
  item{Text(salesReportTypes.firstOrNull{it.first==state.type}?.second?:"Report",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}
  item{ReportFilters(state,vm)}
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}
  state.report?.let{report->item{Text("Asia/Kolkata reporting period",style=MaterialTheme.typography.labelMedium);SummaryCards(report["summary"]?.jsonObject)};val rows=report["rows"]?.jsonArray?:JsonArray(emptyList());if(rows.isEmpty())item{ContentCard("No report records","No records match the selected reporting period.")}else items(rows.size){index->ReportRow(rows[index].jsonObject)}}
 }
}
@Composable private fun SummaryCards(summary:JsonObject?){if(summary==null)return;FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){summary.entries.take(8).forEach{(label,value)->StatusChip("${label.replaceFirstChar{it.uppercase()}} ${display(value)}")}}}
@Composable private fun ReportRow(row:JsonObject){val user=row["user"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull?:row["assignedUser"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull;val customer=row["customer"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull;ContentCard(user?:row["title"]?.jsonPrimitive?.contentOrNull?:customer?:"Report record",listOfNotNull(customer,row["stage"]?.jsonPrimitive?.contentOrNull,row["startedAt"]?.jsonPrimitive?.contentOrNull?:row["checkedInAt"]?.jsonPrimitive?.contentOrNull,row["routeDistanceMeters"]?.jsonPrimitive?.contentOrNull?.let{"Server distance: $it m"}).joinToString(" · ").ifBlank{"Authoritative report record"})}
private fun display(value:JsonElement):String=when(value){is JsonPrimitive->value.content;is JsonObject->value.entries.joinToString{"${it.key}:${display(it.value)}"};else->"—"}

@Composable private fun ReportFilters(state:com.salespunch360.mobile.ReportsState,vm:ReportsViewModel){val employees=state.report?.get("employees")?.jsonArray?:JsonArray(emptyList());val selected=employees.firstOrNull{it.jsonObject["id"]?.jsonPrimitive?.contentOrNull==state.employeeId}?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull?:"All permitted employees";Column(verticalArrangement=Arrangement.spacedBy(6.dp)){Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){DateField("Start",state.start,vm::setStart,Modifier.weight(1f));DateField("End",state.end,vm::setEnd,Modifier.weight(1f))};if(employees.isNotEmpty())TextButton({val index=employees.indexOfFirst{it.jsonObject["id"]?.jsonPrimitive?.contentOrNull==state.employeeId};vm.setEmployee(if(index+1>=employees.size)null else employees[index+1].jsonObject["id"]?.jsonPrimitive?.contentOrNull)}){Text("Employee: $selected")};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button({vm.load()}){Text("Apply")};OutlinedButton(vm::reset){Text("Reset")}};Text("Dates are interpreted by the server in Asia/Kolkata.",style=MaterialTheme.typography.labelSmall)}}
