@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.salespunch360.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.ReportsState
import com.salespunch360.mobile.ReportsViewModel
import kotlinx.serialization.json.*

@Composable
fun AdminTargetAnalysisScreen(state:ReportsState,vm:ReportsViewModel,onBack:(()->Unit)?=null){
 val report=state.report
 val rows=report?.get("rows")?.jsonArray?:JsonArray(emptyList())
 val employees=report?.get("employees")?.jsonArray?:JsonArray(emptyList())
 val summary=report?.get("summary")?.jsonObject
 LazyColumn(
  Modifier.fillMaxSize().padding(horizontal=16.dp),
  contentPadding=PaddingValues(vertical=14.dp),
  verticalArrangement=Arrangement.spacedBy(10.dp),
 ){
  item{
   onBack?.let{back->TextButton(onClick=back,contentPadding=PaddingValues(0.dp)){Text("← Reports")}}
   Text("Target Analysis",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   Text("Current calendar-month Target / Actual values use the same rules and data as Web Target Analysis.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  }
  item{
   OutlinedCard(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,SalesLine)){
    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     TargetEmployeeDropdown(state.employeeId,employees,vm::setEmployee)
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      Button({vm.load("targets")},enabled=!state.loading,modifier=Modifier.weight(1f)){Text("View Report")}
      OutlinedButton(vm::reset,enabled=!state.loading){Text("Reset")}
     }
    }
   }
  }
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.message?.let{item{ContentCard("Report unavailable",it)}}
  if(!state.loading&&state.message==null){
   item{
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     TargetMetric("Check-ins Target",summary?.get("checkInsTarget")?.jsonPrimitive?.intOrNull?:0)
     TargetMetric("Check-ins",summary?.get("checkIns")?.jsonPrimitive?.intOrNull?:0)
     TargetMetric("Leads Won Target",summary?.get("leadsWonTarget")?.jsonPrimitive?.intOrNull?:0)
     TargetMetric("Leads Won",summary?.get("leadsWon")?.jsonPrimitive?.intOrNull?:0)
    }
   }
   if(rows.isEmpty())item{ContentCard("No target data","No target data is available for this employee selection.")}
   else items(rows,key={it.jsonObject.targetText("id")?:it.toString()}){item->
    val row=item.jsonObject
    OutlinedCard(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,SalesLine),colors=CardDefaults.outlinedCardColors(containerColor=Color.White)){
     Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
      Text(row.targetText("name")?:"Employee",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold,color=SalesInk)
      Text(if(row.targetText("salesRole")=="MANAGER")"Field Manager" else "Sales",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
      Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
       Column(Modifier.weight(1f)){Text("CHECK-INS TARGET / ACTUAL",style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text("${row.targetInt("leadTarget")} / ${row.targetInt("created")}",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}
       Column(Modifier.weight(1f)){Text("LEADS WON TARGET / ACTUAL",style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text("${row.targetInt("wonTarget")} / ${row.targetInt("won")}",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)}
      }
     }
    }
   }
  }
 }
}

@Composable
private fun TargetMetric(label:String,value:Int){Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFF7FAFF),border=BorderStroke(1.dp,Color(0xFFDCE6F8))){Column(Modifier.padding(horizontal=12.dp,vertical=9.dp)){Text(value.toString(),fontWeight=FontWeight.Bold,color=SalesInk);Text(label,style=MaterialTheme.typography.labelSmall,color=SalesMuted)}}}

@Composable
private fun TargetEmployeeDropdown(selected:String?,options:JsonArray,change:(String?)->Unit){
 var open by remember{mutableStateOf(false)}
 val name=options.firstOrNull{it.jsonObject.targetText("id")==selected}?.jsonObject?.targetText("name")
 Box{
  OutlinedButton({open=true},Modifier.fillMaxWidth()){
   Column(Modifier.weight(1f),horizontalAlignment=Alignment.Start){Text("Employee",style=MaterialTheme.typography.labelSmall,color=SalesMuted);Text(name?:"All Employees")}
   Icon(Icons.Default.ArrowDropDown,null)
  }
  DropdownMenu(expanded=open,onDismissRequest={open=false}){
   DropdownMenuItem(text={Text("All Employees")},onClick={change(null);open=false})
   options.forEach{item->val row=item.jsonObject;DropdownMenuItem(text={Text(row.targetText("name")?:"Employee")},onClick={change(row.targetText("id"));open=false})}
  }
 }
}

private fun JsonObject.targetText(key:String)=this[key]?.jsonPrimitive?.contentOrNull
private fun JsonObject.targetInt(key:String)=this[key]?.jsonPrimitive?.intOrNull?:0
