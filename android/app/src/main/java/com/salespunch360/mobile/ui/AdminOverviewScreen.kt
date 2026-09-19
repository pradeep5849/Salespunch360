package com.salespunch360.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.DashboardViewModel
import com.salespunch360.mobile.data.*

@Composable fun AdminOverviewScreen(data:Bootstrap,role:MobileRole,openCheckInReport:()->Unit,vm:DashboardViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;val dash=data.adminDashboard;var menu by remember{mutableStateOf(false)}
 LaunchedEffect(Unit){vm.load()}
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text(if(role==MobileRole.PRIMARY_ADMIN)"PRIMARY ADMIN" else if(role==MobileRole.ADMIN)"ADDITIONAL ADMIN" else if(data.user.managerType=="MANAGER_ONLY")"OFFICE MANAGER" else "SALES MANAGER",style=MaterialTheme.typography.labelLarge,color=SalesBlue,fontWeight=FontWeight.Bold);Text("Good day, ${data.user.name.substringBefore(' ')}!",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk);Text(if(role==MobileRole.MANAGER)"Your assigned team overview." else "Your company field-team overview.",color=SalesMuted)}
  item{Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){OverviewMetric("Team members",dash?.teamMemberCount,Modifier.weight(1f));OverviewMetric("Present today",dash?.presentToday,Modifier.weight(1f))};Spacer(Modifier.height(8.dp));Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){OverviewMetric("Check-ins today",dash?.todayVisitCount,Modifier.weight(1f));OverviewMetric("Leads today",dash?.todayLeadCount,Modifier.weight(1f))}}
  item{OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Check-in Activity",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);TextButton(openCheckInReport){Text("View All")}};Box{OutlinedButton({menu=true},Modifier.fillMaxWidth()){Text(state.employees.firstOrNull{it.id==state.selectedCheckEmployeeId}?.name?:"All authorized employees")};DropdownMenu(menu,{menu=false}){DropdownMenuItem({Text("All authorized employees")},{menu=false;vm.selectCheck(null)});state.employees.forEach{e->DropdownMenuItem({Text("${e.name} · ${e.salesRole.name.replace('_',' ')}")},{menu=false;vm.selectCheck(e.id)})}}};if(state.loading)LinearProgressIndicator(Modifier.fillMaxWidth());if(state.recentVisits.isEmpty()&&!state.loading)Text("No completed check-ins match this selection.",color=SalesMuted);state.recentVisits.take(6).forEach{v->HorizontalDivider(color=SalesLine);Text("${v.userName?:"Employee"} · ${v.customerName?:v.contactName?:"Field prospect"}",fontWeight=FontWeight.Bold);v.checkInAddress?.let{Text(it,style=MaterialTheme.typography.bodySmall,color=SalesMuted)};Text("${overviewTime(v.checkedInAt)}${v.checkoutSentiment?.let{" · $it"}?:""}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);TextButton(openCheckInReport,contentPadding=PaddingValues(0.dp)){Text("Details")}}}}}
  item{LiveTrackingCard(vm)}
 }
}
@Composable private fun OverviewMetric(label:String,value:Int?,modifier:Modifier){Card(modifier,shape=RoundedCornerShape(14.dp),colors=CardDefaults.cardColors(containerColor=Color.White),border=BorderStroke(1.dp,SalesLine)){Column(Modifier.padding(12.dp)){Text(label,style=MaterialTheme.typography.labelMedium,color=SalesMuted);Text(value?.toString()?:"—",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)}}}
private fun overviewTime(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("d MMM, h:mm a"))}.getOrDefault(value)
