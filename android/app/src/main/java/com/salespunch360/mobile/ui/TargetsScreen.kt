package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.TargetsViewModel
import com.salespunch360.mobile.data.*

@Composable fun TargetsScreen(role:MobileRole,vm:TargetsViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 LaunchedEffect(role){vm.loadMonthly()}
 val monthly=state.monthly
 if(state.loading&&monthly==null){LoadingScreen("Loading targets…");return}
 if(monthly==null){RetryScreen(state.message?:"Targets unavailable.",vm::loadMonthly);return}
 val canEdit=role!=MobileRole.SALES
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),contentPadding=PaddingValues(vertical=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{
   Text("Sales Targets",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   Text("${monthly.month.startText} to ${monthly.month.endText}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
   Text("Monthly targets carry forward; actuals restart each month.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
   Spacer(Modifier.height(8.dp))
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    Text("Employee",Modifier.weight(1.15f),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold)
    Text("Leads Target",Modifier.weight(.8f),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold)
    Text("Won Target",Modifier.weight(.8f),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold)
   }
   HorizontalDivider(Modifier.padding(top=6.dp),color=SalesLine)
   state.message?.let{Text(it,Modifier.padding(top=6.dp),style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
  }
  if(monthly.rows.isEmpty())item{ContentCard("No employees","No active field employees are visible in your current scope.")}
  items(monthly.rows,key={it.id}){row->MonthlyTargetCard(row,canEdit,state.saving){lead,won->vm.saveMonthly(row.id,lead,won)}}
 }
}

@Composable private fun MonthlyTargetCard(row:MonthlyTargetRow,canEdit:Boolean,saving:Boolean,save:(Int,Int)->Unit){
 var editing by remember(row.id,row.leadTarget,row.wonTarget){mutableStateOf(canEdit&&!row.hasTarget)}
 var leads by remember(row.id,row.leadTarget){mutableStateOf(row.leadTarget.toString())}
 var won by remember(row.id,row.wonTarget){mutableStateOf(row.wonTarget.toString())}
 OutlinedCard(Modifier.fillMaxWidth()){
  Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    Column(Modifier.weight(1.15f)){Text(row.name,fontWeight=FontWeight.Bold,color=SalesInk);Text(salesTargetRole(row),style=MaterialTheme.typography.labelSmall,color=SalesMuted)}
    TargetCompactField("Leads",leads,editing,{leads=it},"${row.created} created",Modifier.weight(.8f))
    TargetCompactField("Won",won,editing,{won=it},"${row.won} won",Modifier.weight(.8f))
   }
   if(canEdit){
    if(editing)Button({save(leads.toIntOrNull()?.coerceAtLeast(0)?:0,won.toIntOrNull()?.coerceAtLeast(0)?:0);editing=false},enabled=!saving,modifier=Modifier.fillMaxWidth()){Text(if(saving)"Saving…" else "Save Targets")}
    else OutlinedButton({editing=true},Modifier.fillMaxWidth()){Text("Edit Targets")}
   } else {
    Text("Leads ${row.created} / ${row.leadTarget}   ·   Won ${row.won} / ${row.wonTarget}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
   }
  }
 }
}

@Composable private fun TargetCompactField(label:String,value:String,editing:Boolean,change:(String)->Unit,actual:String,modifier:Modifier){
 Column(modifier,verticalArrangement=Arrangement.spacedBy(3.dp)){
  if(editing)OutlinedTextField(value,{change(it.filter(Char::isDigit).take(6))},singleLine=true,label={Text(label)},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),modifier=Modifier.fillMaxWidth())
  else Text(value,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
  Text(actual,style=MaterialTheme.typography.labelSmall,color=SalesMuted)
 }
}
private fun salesTargetRole(row:MonthlyTargetRow)=when(row.salesRole){MobileRole.SALES->"Sales";MobileRole.MANAGER->if(row.managerType=="MANAGER_ONLY")"Manager Only" else "Field Manager";MobileRole.PRIMARY_ADMIN->"Primary Admin";MobileRole.ADMIN->"Admin"}
