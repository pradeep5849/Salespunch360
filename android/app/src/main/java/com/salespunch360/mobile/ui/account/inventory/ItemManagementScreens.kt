package com.salespunch360.mobile.ui.account.inventory

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.ItemManagementViewModel
import com.salespunch360.mobile.data.AccountMasterRecord
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoriesManagementScreen(
    back:()->Unit,
    navigate:(String)->Unit,
    vm:ItemManagementViewModel=viewModel()
){
    val s=vm.state.collectAsStateWithLifecycle().value
    var q by remember{mutableStateOf("")}
    var add by remember{mutableStateOf(false)}
    var name by remember{mutableStateOf("")}
    val rows=s.categories.filter{it.name.contains(q,true)}
    val counts=remember(s.items,s.services){
        buildMap<String,Int>{
            (s.items+s.services).filter{it.isActive}.forEach{r->r.categoryId?.let{id->put(id,(get(id)?:0)+1)}}
        }
    }
    val uncategorized=(s.items+s.services).count{it.isActive&&it.categoryId==null}
    Scaffold(
        topBar={TopAppBar(title={Text("Categories")},navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}},actions={IconButton(onClick={navigate("/workspace/account/inventory/item-settings")}){Icon(Icons.Default.Settings,"Item settings")}})},
        floatingActionButton={ExtendedFloatingActionButton(onClick={add=true},icon={Icon(Icons.Default.Add,null)},text={Text("Add Category")})}
    ){padding->
        LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(bottom=96.dp)){
            item{OutlinedTextField(q,{q=it},placeholder={Text("Search Category")},leadingIcon={Icon(Icons.Default.Search,null)},singleLine=true,modifier=Modifier.fillMaxWidth().padding(16.dp))}
            item{Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=10.dp),horizontalArrangement=Arrangement.SpaceBetween){Text("Category Name",color=MaterialTheme.colorScheme.onSurfaceVariant);Text("Item Count",color=MaterialTheme.colorScheme.onSurfaceVariant)}}
            item{ListItem(headlineContent={Text("Items Not in Any Category")},trailingContent={Text(uncategorized.toString())});HorizontalDivider()}
            items(rows,key={it.id}){cat->ListItem(headlineContent={Text(cat.name.uppercase())},trailingContent={Text((counts[cat.id]?:0).toString())});HorizontalDivider()}
        }
    }
    if(add)ModalBottomSheet(onDismissRequest={add=false}){
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("Add Category",style=MaterialTheme.typography.headlineSmall);IconButton(onClick={add=false}){Icon(Icons.Default.Close,"Close")}}
            OutlinedTextField(name,{name=it},placeholder={Text("Enter Category Name")},modifier=Modifier.fillMaxWidth())
            Button(onClick={vm.saveCategory(name){name="";add=false}},enabled=name.isNotBlank()&&!s.saving,modifier=Modifier.fillMaxWidth().height(56.dp)){Text(if(s.saving)"Creating…" else "Create")}
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UnitsManagementScreen(
    back:()->Unit,
    navigate:(String)->Unit,
    vm:ItemManagementViewModel=viewModel()
){
    val s=vm.state.collectAsStateWithLifecycle().value
    var q by remember{mutableStateOf("")}
    var edit by remember{mutableStateOf<AccountMasterRecord?>(null)}
    var add by remember{mutableStateOf(false)}
    var name by remember{mutableStateOf("")}
    var symbol by remember{mutableStateOf("")}
    var conversion by remember{mutableStateOf(false)}
    var base by remember{mutableStateOf("")}
    var secondary by remember{mutableStateOf("")}
    var rate by remember{mutableStateOf("1")}
    val rows=s.units.filter{"${it.name} ${it.symbol.orEmpty()}".contains(q,true)}
    if(conversion){
        Scaffold(
            topBar={TopAppBar(title={Text("Set Conversion")},navigationIcon={IconButton(onClick={conversion=false}){Icon(Icons.Default.ArrowBack,"Back")}})},
            bottomBar={Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick={conversion=false},Modifier.weight(1f).height(56.dp)){Text("Cancel")};Button(onClick={vm.saveConversion(base,secondary,rate){conversion=false}},enabled=base.isNotBlank()&&secondary.isNotBlank()&&base!=secondary&&(rate.toDoubleOrNull()?:0.0)>0&&!s.saving,modifier=Modifier.weight(1f).height(56.dp)){Text("Save")}}}
        ){padding->
            Column(Modifier.fillMaxSize().padding(padding).padding(20.dp),verticalArrangement=Arrangement.spacedBy(22.dp)){
                UnitPicker("Base unit",base,s.units){base=it}
                UnitPicker("Secondary unit",secondary,s.units){secondary=it}
                OutlinedTextField(rate,{rate=it},label={Text("Conversion Rate")},modifier=Modifier.fillMaxWidth())
                Text("ⓘ 1 ${s.units.firstOrNull{it.id==base}?.name?.uppercase()?:"BASE"} = ${rate.ifBlank{"0"}} ${s.units.firstOrNull{it.id==secondary}?.name?.uppercase()?:"SECONDARY"}")
            }
        }
        return
    }
    Scaffold(
        topBar={TopAppBar(title={Text("Units")},navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}},actions={IconButton(onClick={navigate("/workspace/account/inventory/item-settings")}){Icon(Icons.Default.Settings,"Item settings")}})},
        floatingActionButton={ExtendedFloatingActionButton(onClick={edit=null;name="";symbol="";add=true},icon={Icon(Icons.Default.Add,null)},text={Text("Add Unit")})}
    ){padding->
        LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(bottom=96.dp)){
            item{OutlinedTextField(q,{q=it},placeholder={Text("Search Unit")},leadingIcon={Icon(Icons.Default.Search,null)},modifier=Modifier.fillMaxWidth().padding(16.dp))}
            item{Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=6.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){FilledTonalButton(onClick={base=s.units.getOrNull(0)?.id.orEmpty();secondary=s.units.getOrNull(1)?.id.orEmpty();rate="1";conversion=true},modifier=Modifier.weight(1f)){Text("Set Conversion")};FilledTonalButton(onClick={},enabled=false,modifier=Modifier.weight(1f)){Text("Unit to Items")}}}
            items(rows,key={it.id}){u->
                ListItem(
                    headlineContent={Text(u.name.uppercase(),fontWeight=FontWeight.SemiBold)},
                    supportingContent={Text(u.symbol.orEmpty())},
                    trailingContent={IconButton(onClick={edit=u;name=u.name;symbol=u.symbol.orEmpty();add=true}){Icon(Icons.Default.Edit,"Edit")}}
                )
                HorizontalDivider()
            }
        }
    }
    if(add)ModalBottomSheet(onDismissRequest={add=false}){
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text(if(edit==null)"Add Unit" else "Edit Unit",style=MaterialTheme.typography.headlineSmall);IconButton(onClick={add=false}){Icon(Icons.Default.Close,"Close")}}
            OutlinedTextField(name,{name=it},placeholder={Text("Enter Full Unit Name")},modifier=Modifier.fillMaxWidth())
            OutlinedTextField(symbol,{symbol=it},placeholder={Text("Short Name")},modifier=Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick={add=false},Modifier.weight(1f).height(56.dp)){Text("Cancel")};Button(onClick={vm.saveUnit(edit?.id,name,symbol){add=false}},enabled=name.isNotBlank()&&symbol.isNotBlank()&&!s.saving,modifier=Modifier.weight(1f).height(56.dp)){Text("Save")}}
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveItemsManagementScreen(
    activate:Boolean,
    back:()->Unit,
    vm:ItemManagementViewModel=viewModel()
){
    val s=vm.state.collectAsStateWithLifecycle().value
    var products by remember{mutableStateOf(true)}
    var q by remember{mutableStateOf("")}
    var selected by remember{mutableStateOf(setOf<String>())}
    val source=(if(products)s.items else s.services).filter{it.isActive!=activate}
    val rows=source.filter{"${it.name} ${it.code.orEmpty()}".contains(q,true)}
    val stockMap=remember(s.stock){s.stock.associate{row->val p=row["product"]?.jsonObject; p?.get("id")?.jsonPrimitive?.content.orEmpty() to (row["quantity"]?.jsonPrimitive?.content?.toDoubleOrNull()?:0.0)}}
    Scaffold(
        topBar={TopAppBar(title={Text(if(activate)"Inactive Items" else "Active Items")},navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}})},
        bottomBar={Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick=back,Modifier.weight(1f).height(56.dp)){Text("Cancel")};Button(onClick={vm.setActive(if(products)"items" else "services",selected.toList(),activate){back()}},enabled=selected.isNotEmpty()&&!s.saving,modifier=Modifier.weight(1f).height(56.dp)){Text(if(activate)"Mark as Active" else "Mark as Inactive")}}}
    ){padding->
        LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(bottom=20.dp)){
            item{Row(Modifier.fillMaxWidth().padding(18.dp),horizontalArrangement=Arrangement.spacedBy(40.dp)){RadioChoice("Products",products){products=true;selected=emptySet()};RadioChoice("Services",!products){products=false;selected=emptySet()}}}
            item{OutlinedTextField(q,{q=it},placeholder={Text("Search by Name or Code")},leadingIcon={Icon(Icons.Default.Search,null)},modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=8.dp))}
            if(rows.isNotEmpty())item{Row(Modifier.fillMaxWidth().clickable{selected=if(rows.all{it.id in selected})emptySet() else rows.map{it.id}.toSet()}.padding(18.dp),verticalAlignment=Alignment.CenterVertically){Checkbox(rows.all{it.id in selected},{checked->selected=if(checked)rows.map{it.id}.toSet() else emptySet()});Text("Select All")}}
            if(rows.isEmpty()&&activate)item{Box(Modifier.fillMaxWidth().height(420.dp),contentAlignment=Alignment.Center){Text("There are no Inactive Items yet.",style=MaterialTheme.typography.titleMedium)}}
            items(rows,key={it.id}){r->
                Row(Modifier.fillMaxWidth().clickable{selected=if(r.id in selected)selected-r.id else selected+r.id}.padding(horizontal=18.dp,vertical=14.dp),verticalAlignment=Alignment.CenterVertically){
                    Checkbox(r.id in selected,{checked->selected=if(checked)selected+r.id else selected-r.id})
                    Text(r.name,Modifier.weight(1f).padding(start=10.dp))
                    if(products)Text("%.1f".format(stockMap[r.id]?:0.0))
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun RadioChoice(label:String,selected:Boolean,onClick:()->Unit){Row(verticalAlignment=Alignment.CenterVertically){RadioButton(selected,onClick=onClick);Text(label,style=MaterialTheme.typography.titleMedium)}}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UnitPicker(label:String,value:String,units:List<AccountMasterRecord>,onChange:(String)->Unit){
    var open by remember{mutableStateOf(false)}
    ExposedDropdownMenuBox(expanded=open,onExpandedChange={open=it}){
        OutlinedTextField(units.firstOrNull{it.id==value}?.name.orEmpty(),{},readOnly=true,label={Text(label)},modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),trailingIcon={ExposedDropdownMenuDefaults.TrailingIcon(open)})
        ExposedDropdownMenu(expanded=open,onDismissRequest={open=false}){units.forEach{u->DropdownMenuItem({Text(u.name.uppercase())},{onChange(u.id);open=false})}}
    }
}
