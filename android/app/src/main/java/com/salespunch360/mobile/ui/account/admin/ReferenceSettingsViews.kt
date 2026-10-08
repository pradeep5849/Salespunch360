package com.salespunch360.mobile.ui.account.admin

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountAdministrationViewModel
import com.salespunch360.mobile.data.AccountMasterRecord
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

private val RefBlue=Color(0xFFE7F4FF)
private val RefText=Color(0xFF303342)

@Composable private fun RefSection(title:String){Box(Modifier.fillMaxWidth().background(RefBlue).padding(horizontal=16.dp,vertical=9.dp)){Text(title,fontSize=17.sp,fontWeight=FontWeight.Bold,color=Color(0xFF294C5D))}}
@Composable private fun RefSwitchRow(label:String,checked:Boolean,onChange:(Boolean)->Unit){Row(Modifier.fillMaxWidth().heightIn(min=62.dp).padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Text(label,Modifier.weight(1f),fontSize=16.sp);Text("ⓘ",fontSize=13.sp,color=Color.Gray);Spacer(Modifier.width(8.dp));Switch(checked,onChange)}}
@Composable private fun RefNavRow(label:String,onClick:()->Unit){Row(Modifier.fillMaxWidth().heightIn(min=62.dp).clickable(onClick=onClick).padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Text(label,Modifier.weight(1f),fontSize=16.sp);Text("›",fontSize=28.sp,color=Color.DarkGray)}}

@Composable fun ReminderLandingView(navigate:(String)->Unit){
 Column(Modifier.fillMaxSize().background(RefBlue).padding(14.dp)){
  Card(Modifier.fillMaxWidth().clickable{navigate("/workspace/account/settings/reminders/payment")},shape=RoundedCornerShape(14.dp)){RefNavRow("Payment Reminders"){navigate("/workspace/account/settings/reminders/payment")}}
  Spacer(Modifier.height(18.dp))
  Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp)){
   Column{RefNavRow("Service Reminders"){navigate("/workspace/account/settings/reminders/service")};HorizontalDivider();Text("Benefits of Service Reminders:",Modifier.padding(16.dp),fontSize=14.sp,fontWeight=FontWeight.SemiBold);Row(Modifier.fillMaxWidth().padding(bottom=16.dp),horizontalArrangement=Arrangement.SpaceEvenly){listOf("♧\nRemind your\nparties","♙\nDon't lose\ncustomers","↗\nGrow your\nbusiness").forEach{Text(it,textAlign=androidx.compose.ui.text.style.TextAlign.Center,fontSize=13.sp,lineHeight=18.sp)}};Surface(color=Color(0xFFF1F2F7)){Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(110.dp,60.dp).background(Color(0xFF263342),RoundedCornerShape(7.dp)),contentAlignment=Alignment.Center){Text("▶",color=Color.White,fontSize=22.sp)};Spacer(Modifier.width(14.dp));Column{Text("How do Service Reminders work?",fontWeight=FontWeight.Bold,fontSize=15.sp);Text("Watch Video  ›",color=Color(0xFFE4203B),fontSize=15.sp)}}}}
  }
 }
}

@Composable fun PaymentReminderView(data:JsonElement,vm:AccountAdministrationViewModel,navigate:(String)->Unit){
 val saved=(data as? JsonObject)?.get("settings")?.jsonObject?.get("transactionDefaults")?.jsonObject?.get("reminderSettings")?.jsonObject?.get("payment")?.jsonObject
 var enabled by remember(saved){mutableStateOf(saved?.get("enabled")?.jsonPrimitive?.booleanOrNull?:true)}
 var days by remember(saved){mutableStateOf(saved?.get("overdueDays")?.jsonPrimitive?.intOrNull?:1)}
 var frequency by remember(saved){mutableStateOf(saved?.get("frequency")?.jsonPrimitive?.content?:"TWICE_DAILY")}
 fun save(){vm.save("reminders",buildJsonObject{putJsonObject("payment"){put("enabled",enabled);put("overdueDays",days);put("frequency",frequency)}})}
 Column(Modifier.fillMaxSize().background(Color.White)){
  RefSwitchRow("Self Payment Reminder",enabled){enabled=it;save()};HorizontalDivider()
  Row(Modifier.fillMaxWidth().heightIn(min=76.dp).padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Text("Remind me for payment due\nmore than",Modifier.weight(1f),fontSize=16.sp);TextButton({if(days>0){days--;save()}}){Text("−",fontSize=22.sp)};Text(days.toString(),fontSize=17.sp,modifier=Modifier.padding(horizontal=6.dp));TextButton({if(days<365){days++;save()}}){Text("+",fontSize=22.sp)}}
  HorizontalDivider()
  var open by remember{mutableStateOf(false)}
  Box{Row(Modifier.fillMaxWidth().heightIn(min=76.dp).clickable{open=true}.padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Text("Self Payment\nReminder",Modifier.weight(1f),fontSize=16.sp);Text(when(frequency){"ONCE_DAILY"->"1 Time a day";"THREE_DAILY"->"3 Times a day";"WEEKLY"->"Once a week";else->"2 Times a day"},color=Color.Gray,fontSize=16.sp);Text(" ▾",color=Color.Gray)};DropdownMenu(open,{open=false}){listOf("ONCE_DAILY" to "1 Time a day","TWICE_DAILY" to "2 Times a day","THREE_DAILY" to "3 Times a day","WEEKLY" to "Once a week").forEach{(v,l)->DropdownMenuItem({Text(l)},{frequency=v;open=false;save()})}}}
  RefSection("Payment Reminder For party")
  RefNavRow("Reminder message to party"){navigate("/workspace/account/settings/reminders/payment/message")}
 }
}

@Composable fun PaymentReminderMessageView(data:JsonElement,vm:AccountAdministrationViewModel){
 val saved=(data as? JsonObject)?.get("settings")?.jsonObject?.get("transactionDefaults")?.jsonObject?.get("reminderSettings")?.jsonObject?.get("payment")?.jsonObject
 var message by remember(saved){mutableStateOf(saved?.get("message")?.jsonPrimitive?.content?:"Dear {party}, payment of {amount} is overdue. Please arrange payment at the earliest.")}
 Column(Modifier.fillMaxSize().padding(16.dp)){OutlinedTextField(message,{message=it.take(2000)},label={Text("Reminder message to party")},modifier=Modifier.fillMaxWidth().heightIn(min=180.dp));Spacer(Modifier.height(12.dp));Button({vm.save("reminders",buildJsonObject{putJsonObject("payment"){put("message",message)}})},modifier=Modifier.fillMaxWidth()){Text("Save Reminder Message")}}
}

data class ServiceReminderState(val loading:Boolean=false,val items:List<AccountMasterRecord> = emptyList(),val services:List<AccountMasterRecord> = emptyList(),val selected:Set<String> = emptySet(),val error:String?=null)
class ServiceReminderViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ServiceReminderState());val state=_state.asStateFlow()
 init{load()}
 fun load()=viewModelScope.launch{_state.value=_state.value.copy(loading=true,error=null);runCatching{val settings=api.accountAdministration("settings");val selected=settings.jsonObject["settings"]?.jsonObject?.get("transactionDefaults")?.jsonObject?.get("reminderSettings")?.jsonObject?.get("service")?.jsonObject?.get("selectedItemIds")?.jsonArray?.mapNotNull{it.jsonPrimitive.contentOrNull}?.toSet().orEmpty();Triple(api.accountMasterList("items","","true"),api.accountMasterList("services","","true"),selected)}.onSuccess{_state.value=ServiceReminderState(false,it.first,it.second,it.third)}.onFailure{_state.value=_state.value.copy(loading=false,error=it.message)}}
 fun toggle(id:String){_state.value=_state.value.copy(selected=_state.value.selected.toMutableSet().apply{if(!add(id))remove(id)})}
 fun setAll(ids:List<String>,checked:Boolean){_state.value=_state.value.copy(selected=_state.value.selected.toMutableSet().apply{if(checked)addAll(ids)else removeAll(ids.toSet())})}
 fun save(done:()->Unit)=viewModelScope.launch{runCatching{api.saveAccountAdministration("settings","reminders",buildJsonObject{putJsonObject("service"){put("enabled",true);putJsonArray("selectedItemIds"){_state.value.selected.forEach{add(it)}}}})}.onSuccess{done()}.onFailure{_state.value=_state.value.copy(error=it.message)}}
}

@Composable fun ServiceReminderView(back:()->Unit,vm:ServiceReminderViewModel=viewModel()){
 val s=vm.state.collectAsStateWithLifecycle().value;var tab by remember{mutableStateOf("ALL")};var query by remember{mutableStateOf("")};val rows=(if(tab=="PRODUCT")s.items else if(tab=="SERVICE")s.services else s.items+s.services).filter{it.name.contains(query,true)};val all=rows.isNotEmpty()&&rows.all{it.id in s.selected}
 Column(Modifier.fillMaxSize().background(RefBlue)){
  Row(Modifier.fillMaxWidth().padding(10.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("ALL" to "All Items","PRODUCT" to "Products","SERVICE" to "Services").forEach{(v,l)->FilterChip(tab==v,{tab=v},{Text(l)})}}
  OutlinedTextField(query,{query=it},placeholder={Text("Search Items")},modifier=Modifier.fillMaxWidth().padding(horizontal=14.dp),singleLine=true)
  Spacer(Modifier.height(12.dp));Card(Modifier.weight(1f).fillMaxWidth().padding(horizontal=14.dp),shape=RoundedCornerShape(12.dp)){LazyColumn{item{Row(Modifier.fillMaxWidth().heightIn(min=62.dp).padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Text("Select All",Modifier.weight(1f),fontSize=16.sp);Checkbox(all,{vm.setAll(rows.map{x->x.id},it)})};HorizontalDivider()};items(rows){x->Row(Modifier.fillMaxWidth().heightIn(min=62.dp).padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Text(x.name,Modifier.weight(1f),fontSize=16.sp);Checkbox(x.id in s.selected,{vm.toggle(x.id)})};HorizontalDivider()}}}
  Button(onClick={vm.save(back)},enabled=s.selected.isNotEmpty(),modifier=Modifier.fillMaxWidth().height(62.dp),shape=RoundedCornerShape(0.dp)){Text("Continue",fontSize=17.sp)}
 }
}

@Composable fun TaxPreferencesView(data:JsonElement,vm:AccountAdministrationViewModel,navigate:(String)->Unit){
 val settings=(data as? JsonObject)?.get("settings")?.jsonObject;val stored=settings?.get("transactionDefaults")?.jsonObject?.get("taxPreferences")?.jsonObject
 fun b(k:String,d:Boolean)=stored?.get(k)?.jsonPrimitive?.booleanOrNull?:d
 var gst by remember(stored){mutableStateOf(b("gst",settings?.get("gstRegistrationType")?.jsonPrimitive?.content!="UNREGISTERED"))};var hsn by remember(stored){mutableStateOf(b("hsnSac",true))};var cess by remember(stored){mutableStateOf(b("additionalCess",false))};var reverse by remember(stored){mutableStateOf(b("reverseCharge",false))};var state by remember(stored){mutableStateOf(b("stateOfSupply",true))};var eway by remember(stored){mutableStateOf(b("ewayBillNumber",false))};var composite by remember(stored){mutableStateOf(b("compositeScheme",false))};var tcs by remember(stored){mutableStateOf(b("enableTcs",false))};var tds by remember(stored){mutableStateOf(b("enableTds",false))}
 fun save(){vm.save("tax-preferences",buildJsonObject{put("gst",gst);put("hsnSac",hsn);put("additionalCess",cess);put("reverseCharge",reverse);put("stateOfSupply",state);put("ewayBillNumber",eway);put("compositeScheme",composite);put("enableTcs",tcs);put("enableTds",tds)})}
 LazyColumn(Modifier.fillMaxSize()){item{RefNavRow("Tax List"){navigate("/workspace/account/tax/list")}};item{RefSwitchRow("GST",gst){gst=it;save()}};item{RefSwitchRow("HSN/SAC Code",hsn){hsn=it;save()}};item{RefSwitchRow("Additional CESS",cess){cess=it;save()}};item{RefSwitchRow("Reverse Charge",reverse){reverse=it;save()}};item{RefSwitchRow("State of Supply",state){state=it;save()}};item{RefSwitchRow("E-Way Bill No.",eway){eway=it;save()}};item{RefSwitchRow("Composite Scheme",composite){composite=it;save()}};item{RefSwitchRow("Enable TCS",tcs){tcs=it;save()}};item{RefSwitchRow("Enable TDS",tds){tds=it;save()}}}
}

private val standardGroups=listOf("GST@0%" to "SGST@0%     CGST@0%","GST@0.25%" to "SGST@0.125%     CGST@0.125%","GST@3%" to "SGST@1.5%     CGST@1.5%","GST@5%" to "SGST@2.5%     CGST@2.5%","GST@12%" to "SGST@6%     CGST@6%","GST@18%" to "SGST@9%     CGST@9%","GST@28%" to "SGST@14%     CGST@14%","GST@40%" to "SGST@20%     CGST@20%")
private val standardRates=listOf("CGST@0%" to "0%","Exempt" to "0%","IGST@0%" to "0%","SGST@0%" to "0%","CGST@0.125%" to "0.125%","SGST@0.125%" to "0.125%","IGST@0.25%" to "0.25%","CGST@1.5%" to "1.5%","SGST@1.5%" to "1.5%","CGST@2.5%" to "2.5%","SGST@2.5%" to "2.5%","IGST@3%" to "3%","IGST@5%" to "5%","CGST@6%" to "6%","SGST@6%" to "6%","CGST@9%" to "9%","SGST@9%" to "9%","IGST@12%" to "12%","CGST@14%" to "14%","SGST@14%" to "14%","IGST@18%" to "18%","CGST@20%" to "20%","SGST@20%" to "20%","IGST@28%" to "28%","IGST@40%" to "40%")
@Composable fun TaxListView(){var groups by remember{mutableStateOf(false)};Column(Modifier.fillMaxSize()){TabRow(if(groups)1 else 0){Tab(!groups,{groups=false}){Text("TAX RATES",Modifier.padding(18.dp))};Tab(groups,{groups=true}){Text("TAX GROUPS",Modifier.padding(18.dp))}};LazyColumn{if(!groups)items(standardRates){x->Row(Modifier.fillMaxWidth().heightIn(min=62.dp).padding(horizontal=18.dp),verticalAlignment=Alignment.CenterVertically){Text(x.first,Modifier.weight(1f),fontSize=16.sp);Text(x.second,fontSize=16.sp,color=Color.Gray)};HorizontalDivider()}else items(standardGroups){x->Column(Modifier.fillMaxWidth().padding(horizontal=18.dp,vertical=14.dp)){Text(x.first,fontSize=16.sp,fontWeight=FontWeight.SemiBold);Spacer(Modifier.height(12.dp));Text(x.second,fontSize=14.sp,color=Color.Gray)};HorizontalDivider()}}}}
