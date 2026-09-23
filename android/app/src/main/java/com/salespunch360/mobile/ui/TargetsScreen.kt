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
   Text("Monthly targets carry forward; Leads and Leads Won actuals restart each month.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
   state.message?.let{MessageBanner(it,vm::loadMonthly)}
  }
  if(monthly.rows.isEmpty())item{ContentCard("No employees","No active field employees are visible in your current scope.")}
  items(monthly.rows,key={it.id}){row->MonthlyTargetCard(row,canEdit,state.saving){lead,won,onSaved->vm.saveMonthly(row.id,lead,won,onSaved)}}
 }
}

@Composable private fun MonthlyTargetCard(row:MonthlyTargetRow,canEdit:Boolean,saving:Boolean,save:(Int,Int,()->Unit)->Unit){
 var editing by remember(row.id,row.leadTarget,row.wonTarget){mutableStateOf(false)}
 var leads by remember(row.id,row.leadTarget){mutableStateOf(row.leadTarget.toString())}
 var won by remember(row.id,row.wonTarget){mutableStateOf(row.wonTarget.toString())}
 OutlinedCard(Modifier.fillMaxWidth()){
  Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text(row.name,fontWeight=FontWeight.Bold,color=SalesInk)
   Text(salesTargetRole(row),style=MaterialTheme.typography.labelSmall,color=SalesMuted)
   HorizontalDivider(color=SalesLine)
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){
    Text("Type",Modifier.weight(1f),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=SalesMuted)
    Text("Target",Modifier.width(104.dp),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=SalesMuted)
   }
   TargetCompactField("Leads",leads,canEdit&&editing,{leads=it},row.created,Modifier.fillMaxWidth())
   TargetCompactField("Leads won",won,canEdit&&editing,{won=it},row.won,Modifier.fillMaxWidth())
   if(canEdit&&!editing)OutlinedButton({editing=true},modifier=Modifier.fillMaxWidth()){Text("Edit")}
   if(canEdit&&editing){
    Button({save(leads.toIntOrNull()?.coerceAtLeast(0)?:0,won.toIntOrNull()?.coerceAtLeast(0)?:0){editing=false}},enabled=!saving,modifier=Modifier.fillMaxWidth()){Text(if(saving)"Saving…" else "Save")}
    TextButton({leads=row.leadTarget.toString();won=row.wonTarget.toString();editing=false},enabled=!saving,modifier=Modifier.fillMaxWidth()){Text("Cancel")}
   }
  }
 }
}

@Composable private fun TargetCompactField(label:String,value:String,editable:Boolean,change:(String)->Unit,actual:Int,modifier:Modifier){
 Row(modifier,horizontalArrangement=Arrangement.spacedBy(12.dp)){
  Column(Modifier.weight(1f)){
   Text(label,style=MaterialTheme.typography.bodyMedium,fontWeight=FontWeight.SemiBold,color=SalesInk)
   Text("Actual $actual",style=MaterialTheme.typography.labelSmall,color=SalesMuted)
  }
  if(editable)OutlinedTextField(value,{change(it.filter(Char::isDigit).take(6))},singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),modifier=Modifier.width(104.dp))
  else Text(value,Modifier.width(104.dp),style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
 }
}
private fun salesTargetRole(row:MonthlyTargetRow)=when(row.salesRole){MobileRole.SALES->"Sales";MobileRole.MANAGER->if(row.managerType=="MANAGER_ONLY")"Manager Only" else "Field Manager";MobileRole.PRIMARY_ADMIN->"Primary Admin";MobileRole.ADMIN->"Admin"}
