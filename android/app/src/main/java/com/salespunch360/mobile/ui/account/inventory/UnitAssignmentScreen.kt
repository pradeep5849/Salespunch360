package com.salespunch360.mobile.ui.account.inventory

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.ItemManagementState
import com.salespunch360.mobile.ItemManagementViewModel
import com.salespunch360.mobile.data.AccountMasterRecord
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UnitAssignmentScreen(state:ItemManagementState,vm:ItemManagementViewModel,back:()->Unit){
 var kind by remember{mutableStateOf("PRODUCT")};var query by remember{mutableStateOf("")};var offset by remember{mutableIntStateOf(0)};var selected by remember{mutableStateOf(setOf<String>())};var unitId by remember{mutableStateOf(state.units.firstOrNull()?.id.orEmpty())};var inline by remember{mutableStateOf(false)};var name by remember{mutableStateOf("")};var symbol by remember{mutableStateOf("")}
 LaunchedEffect(kind,query,offset){delay(150);vm.loadAssignment(kind,query,offset)}
 BackHandler{if(!state.saving)back()}
 val currentScope=state.assignmentKind==kind&&state.assignmentQuery==query&&state.assignmentOffset==offset
 val ready=currentScope&&!state.saving&&!state.assignmentLoading&&selected.isNotEmpty()&&(if(inline)name.trim().length in 1..80&&symbol.trim().length in 1..20 else unitId.isNotBlank())
 Scaffold(topBar={TopAppBar(title={Text("Unit to Items")},navigationIcon={IconButton(back,enabled=!state.saving){Icon(Icons.AutoMirrored.Filled.ArrowBack,"Back to Units")}})},bottomBar={Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(back,enabled=!state.saving,modifier=Modifier.weight(1f)){Text("Cancel")};Button(onClick={vm.assignUnits(buildJsonObject{put("kind",kind);putJsonArray("itemIds"){selected.forEach{add(JsonPrimitive(it))}};if(inline)putJsonObject("newUnit"){put("name",name);put("symbol",symbol)}else put("unitId",unitId)},back)},enabled=ready,modifier=Modifier.weight(1f)){Text(if(state.saving)"Saving…"else "Assign unit")}}}){padding->
  LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
   item{Text("Assign a base unit to company items. Items with stock or document quantities retain their existing unit.")}
   item{Row{FilterChip(kind=="PRODUCT",{kind="PRODUCT";selected=emptySet();offset=0},label={Text("Products")},enabled=!state.saving);Spacer(Modifier.width(8.dp));FilterChip(kind=="SERVICE",{kind="SERVICE";selected=emptySet();offset=0},label={Text("Services")},enabled=!state.saving)}}
   item{OutlinedTextField(query,{if(it.length<=160){query=it;offset=0}},label={Text("Search items")},enabled=!state.saving,modifier=Modifier.fillMaxWidth())}
   if(!currentScope||state.assignmentLoading||state.saving)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
   state.assignmentError?.let{error->item{Text(error,color=MaterialTheme.colorScheme.error,modifier=Modifier.semantics{liveRegion=LiveRegionMode.Polite});TextButton({vm.loadAssignment(kind,query,offset)},enabled=!state.saving){Text("Retry loading items")}}}
   item{Text("${selected.size} selected (maximum 200 per assignment)")}
   if(currentScope&&!state.assignmentLoading){
    if(state.assignmentItems.isEmpty()&&state.assignmentError==null)item{Text("No matching items.")}
    item{Row{Checkbox(state.assignmentItems.isNotEmpty()&&state.assignmentItems.all{it.id in selected},{checked->selected=if(checked)(selected+state.assignmentItems.map{it.id}).take(200).toSet()else selected-state.assignmentItems.map{it.id}.toSet()},enabled=!state.saving&&state.assignmentItems.isNotEmpty(),modifier=Modifier.semantics{contentDescription="Select visible items"});Text("Select visible items")}}
    items(state.assignmentItems,key={it.id}){item->ListItem(headlineContent={Text(item.name)},supportingContent={Text((item.code?:"No code")+" · "+(if(item.unitId==null)"Not assigned"else state.units.firstOrNull{it.id==item.unitId}?.name?:"Unavailable unit"))},leadingContent={Checkbox(item.id in selected,{selected=if(it)selected+item.id else selected-item.id},enabled=!state.saving&&(item.id in selected||selected.size<200),modifier=Modifier.semantics{contentDescription="Select ${item.name}"})})}
    item{Row{TextButton({offset=(offset-50).coerceAtLeast(0)},enabled=!state.saving&&offset>0){Text("Previous items")};TextButton({offset=state.assignmentNext?:offset},enabled=!state.saving&&state.assignmentNext!=null){Text("Next items")}}}
   }
   item{Row{Checkbox(inline,{inline=it},enabled=!state.saving,modifier=Modifier.semantics{contentDescription="Create a unit inline"});Text("Create a unit inline")}}
   if(inline){item{OutlinedTextField(name,{if(it.length<=80)name=it},label={Text("Full Unit Name")},enabled=!state.saving,modifier=Modifier.fillMaxWidth())};item{OutlinedTextField(symbol,{if(it.length<=20)symbol=it},label={Text("Short Name")},enabled=!state.saving,modifier=Modifier.fillMaxWidth())}}
   else item{AssignmentUnitPicker(unitId,state.units,!state.saving){unitId=it}}
  }
 }
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AssignmentUnitPicker(value:String,units:List<AccountMasterRecord>,enabled:Boolean,change:(String)->Unit){var open by remember{mutableStateOf(false)};ExposedDropdownMenuBox(open&&enabled,{if(enabled)open=it}){OutlinedTextField(units.firstOrNull{it.id==value}?.name.orEmpty(),{},readOnly=true,enabled=enabled,label={Text("Assignment unit")},modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),trailingIcon={ExposedDropdownMenuDefaults.TrailingIcon(open)});ExposedDropdownMenu(open&&enabled,{open=false}){units.forEach{unit->DropdownMenuItem({Text("${unit.name} (${unit.symbol.orEmpty()})")},{change(unit.id);open=false})}}}}
