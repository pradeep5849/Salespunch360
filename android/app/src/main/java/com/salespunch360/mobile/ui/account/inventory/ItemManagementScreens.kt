package com.salespunch360.mobile.ui.account.inventory

import com.salespunch360.mobile.account.validUnitConversionRate
import androidx.activity.compose.BackHandler
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
import com.salespunch360.mobile.account.str
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
        topBar={TopAppBar(title={Text("Items")},navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}},actions={IconButton(onClick={navigate("/workspace/account/inventory/item-settings")}){Icon(Icons.Default.Settings,"Item settings")}})},
        floatingActionButtonPosition=FabPosition.Center,
        floatingActionButton={ExtendedFloatingActionButton(onClick={add=true},icon={Icon(Icons.Default.Add,null)},text={Text("Add Category")})}
    ){padding->
        LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(bottom=96.dp)){
            item{ScrollableTabRow(selectedTabIndex=2){
                listOf("Products" to "/workspace/account/inventory/catalog?type=PRODUCT","Services" to "/workspace/account/inventory/catalog?type=SERVICE","Categories" to "/workspace/account/inventory/categories","Units" to "/workspace/account/inventory/units").forEachIndexed{index,(title,path)->Tab(selected=index==2,onClick={if(index!=2)navigate(path)},text={Text(title)})}
            }}
            if(s.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
            s.error?.let{message->item{Column(Modifier.padding(16.dp)){Text(message,color=MaterialTheme.colorScheme.error);TextButton(onClick={vm.refresh()},enabled=!s.loading&&!s.saving){Text("Retry")}}}}
            item{OutlinedTextField(q,{q=it},label={Text("Search Category")},leadingIcon={Icon(Icons.Default.Search,null)},singleLine=true,modifier=Modifier.fillMaxWidth().padding(16.dp))}
            item{Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=10.dp),horizontalArrangement=Arrangement.SpaceBetween){Text("Category Name",color=MaterialTheme.colorScheme.onSurfaceVariant);Text("Item Count",color=MaterialTheme.colorScheme.onSurfaceVariant)}}
            item{ListItem(headlineContent={Text("Items Not in Any Category")},trailingContent={Text(if(s.catalogLoaded)uncategorized.toString() else "Unavailable")});HorizontalDivider()}
            items(rows,key={it.id}){cat->ListItem(headlineContent={Text(cat.name.uppercase())},trailingContent={Text(if(s.catalogLoaded)(counts[cat.id]?:0).toString() else "Unavailable")});HorizontalDivider()}
        }
    }
    if(add)ModalBottomSheet(onDismissRequest={if(!s.saving)add=false}){
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("Add Category",style=MaterialTheme.typography.headlineSmall);IconButton(onClick={add=false},enabled=!s.saving){Icon(Icons.Default.Close,"Close")}}
            OutlinedTextField(name,{if(it.length<=100)name=it},label={Text("Category name")},enabled=!s.saving,modifier=Modifier.fillMaxWidth())
            s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
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
    LaunchedEffect(Unit){vm.refreshUnits()}
    var q by remember{mutableStateOf("")}
    var edit by remember{mutableStateOf<AccountMasterRecord?>(null)}
    var add by remember{mutableStateOf(false)}
    var name by remember{mutableStateOf("")}
    var symbol by remember{mutableStateOf("")}
    var assignment by remember{mutableStateOf(false)}
    if(assignment){UnitAssignmentScreen(s,vm){if(!s.saving){assignment=false;vm.closeAssignment()}};return}
    var conversion by remember{mutableStateOf(false)}
    var base by remember{mutableStateOf("")}
    var secondary by remember{mutableStateOf("")}
    var rate by remember{mutableStateOf("1")}
    val rows=if(s.error!=null)emptyList()else s.units.filter{"${it.name} ${it.symbol.orEmpty()}".contains(q,true)}
    val savingNow by rememberUpdatedState(s.saving)
    val sheetState=rememberModalBottomSheetState(skipPartiallyExpanded=true,confirmValueChange={!savingNow})
    BackHandler(enabled=conversion){if(!s.saving)conversion=false}
    if(conversion){
        Scaffold(
            topBar={TopAppBar(title={Text("Set Conversion")},navigationIcon={IconButton(onClick={conversion=false},enabled=!s.saving){Icon(Icons.Default.ArrowBack,"Back")}})},
            bottomBar={Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick={conversion=false},Modifier.weight(1f).height(56.dp),enabled=!s.saving){Text("Cancel")};Button(onClick={vm.saveConversion(base,secondary,rate){conversion=false}},enabled=base.isNotBlank()&&secondary.isNotBlank()&&base!=secondary&&validUnitConversionRate(rate)&&!s.saving,modifier=Modifier.weight(1f).height(56.dp)){Text("Save")}}}
        ){padding->
            Column(Modifier.fillMaxSize().padding(padding).padding(20.dp),verticalArrangement=Arrangement.spacedBy(22.dp)){
                if(s.loading||s.saving)LinearProgressIndicator(Modifier.fillMaxWidth())
                s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
                UnitPicker("Base unit",base,s.units,enabled=!s.saving){base=it}
                UnitPicker("Secondary unit",secondary,s.units,enabled=!s.saving){secondary=it}
                OutlinedTextField(rate,{rate=it},enabled=!s.saving,label={Text("Conversion Rate")},isError=rate.isNotBlank()&&!validUnitConversionRate(rate),supportingText={if(rate.isNotBlank()&&!validUnitConversionRate(rate))Text("Enter a positive rate with up to 14 whole and 4 decimal digits.")},modifier=Modifier.fillMaxWidth())
                Text("ⓘ 1 ${s.units.firstOrNull{it.id==base}?.name?.uppercase()?:"BASE"} = ${rate.ifBlank{"0"}} ${s.units.firstOrNull{it.id==secondary}?.name?.uppercase()?:"SECONDARY"}")
            }
        }
        return
    }
    Scaffold(
        topBar={TopAppBar(title={Text("Units")},navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}},actions={IconButton(onClick={navigate("/workspace/account/inventory/item-settings")}){Icon(Icons.Default.Settings,"Item settings")}})},
        floatingActionButton={ExtendedFloatingActionButton(onClick={edit=null;name="";symbol="";vm.clearError();add=true},icon={Icon(Icons.Default.Add,null)},text={Text("Add Unit")})}
    ){padding->
        LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(bottom=96.dp)){
            item{TabRow(selectedTabIndex=3){listOf("Products" to "/workspace/account/inventory/catalog?type=PRODUCT","Services" to "/workspace/account/inventory/catalog?type=SERVICE","Categories" to "/workspace/account/inventory/categories","Units" to "/workspace/account/inventory/units").forEachIndexed{index,(title,path)->Tab(selected=index==3,onClick={if(index!=3)navigate(path)},text={Text(title)})}}}
            s.message?.let{message->item{Text(message,Modifier.padding(16.dp))}}
            if(s.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
            s.error?.let{message->item{Column(Modifier.padding(16.dp)){Text(message,color=MaterialTheme.colorScheme.error);TextButton(onClick={vm.refreshUnits()}){Text("Retry")}}}}
            if(!s.loading&&s.error==null&&rows.isEmpty())item{Text(if(s.units.isEmpty())"No units have been added yet." else "No units match your search.",Modifier.padding(16.dp))}
            item{OutlinedTextField(q,{q=it},label={Text("Search Unit")},leadingIcon={Icon(Icons.Default.Search,null)},modifier=Modifier.fillMaxWidth().padding(16.dp))}
            item{Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=6.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){FilledTonalButton(onClick={base=s.units.getOrNull(0)?.id.orEmpty();secondary=s.units.getOrNull(1)?.id.orEmpty();rate="1";vm.clearError();conversion=true},modifier=Modifier.weight(1f)){Text("Set Conversion")};FilledTonalButton(onClick={vm.clearError();assignment=true},enabled=!s.saving&&!s.loading,modifier=Modifier.weight(1f)){Text("Unit to Items")}}}
            items(rows,key={it.id}){u->
                ListItem(
                    headlineContent={Text(u.name.uppercase(),fontWeight=FontWeight.SemiBold)},
                    supportingContent={
                        Column{
                            Text(u.symbol.orEmpty())
                            s.unitConversions.filter{it.str("baseUnitId")==u.id}.forEach{rule->
                                Text("1 ${u.symbol.orEmpty()} = ${rule.str("rate")} ${s.units.firstOrNull{it.id==rule.str("secondaryUnitId")}?.symbol.orEmpty()}")
                            }
                        }
                    },
                    trailingContent={IconButton(onClick={edit=u;name=u.name;symbol=u.symbol.orEmpty();vm.clearError();add=true}){Icon(Icons.Default.Edit,"Edit")}}
                )
                HorizontalDivider()
            }
        }
    }
    if(add)ModalBottomSheet(onDismissRequest={if(!s.saving)add=false},sheetState=sheetState){
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text(if(edit==null)"Add Unit" else "Edit Unit",style=MaterialTheme.typography.headlineSmall);IconButton(onClick={add=false},enabled=!s.saving){Icon(Icons.Default.Close,"Close")}}
            s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
            OutlinedTextField(name,{if(it.length<=80)name=it},enabled=!s.saving,label={Text("Full Unit Name")},modifier=Modifier.fillMaxWidth())
            OutlinedTextField(symbol,{if(it.length<=20)symbol=it},enabled=!s.saving,label={Text("Short Name")},modifier=Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick={add=false},Modifier.weight(1f).height(56.dp),enabled=!s.saving){Text("Cancel")};Button(onClick={vm.saveUnit(edit?.id,name,symbol){add=false}},enabled=name.isNotBlank()&&symbol.isNotBlank()&&!s.saving,modifier=Modifier.weight(1f).height(56.dp)){Text("Save")}}
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
    val stockMap=remember(s.stock){runCatching{com.salespunch360.mobile.account.productStockTotals(s.stock)}.getOrNull()}
    Scaffold(
        topBar={TopAppBar(title={Text(if(activate)"Inactive Items" else "Active Items")},navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}})},
        bottomBar={Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick=back,Modifier.weight(1f).height(56.dp)){Text("Cancel")};Button(onClick={vm.setActive(if(products)"items" else "services",selected.toList(),activate){back()}},enabled=selected.isNotEmpty()&&!s.saving&&!s.loading,modifier=Modifier.weight(1f).height(56.dp)){Text(if(activate)"Mark as Active" else "Mark as Inactive")}}}
    ){padding->
        LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(bottom=20.dp)){
            if(s.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
            s.error?.let{message->item{Column(Modifier.padding(16.dp)){Text(message,color=MaterialTheme.colorScheme.error);TextButton(onClick={vm.refresh()}){Text("Retry")}}}}
            item{Row(Modifier.fillMaxWidth().padding(18.dp),horizontalArrangement=Arrangement.spacedBy(40.dp)){RadioChoice("Products",products){products=true;selected=emptySet()};RadioChoice("Services",!products){products=false;selected=emptySet()}}}
            item{OutlinedTextField(q,{q=it},placeholder={Text("Search by Name or Code")},leadingIcon={Icon(Icons.Default.Search,null)},modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=8.dp))}
            if(rows.isNotEmpty())item{Row(Modifier.fillMaxWidth().clickable{selected=if(rows.all{it.id in selected})emptySet() else rows.map{it.id}.toSet()}.padding(18.dp),verticalAlignment=Alignment.CenterVertically){Checkbox(rows.all{it.id in selected},{checked->selected=if(checked)rows.map{it.id}.toSet() else emptySet()});Text("Select All")}}
            if(rows.isEmpty()&&activate&&!s.loading&&s.error==null)item{Box(Modifier.fillMaxWidth().height(420.dp),contentAlignment=Alignment.Center){Text("There are no Inactive Items yet.",style=MaterialTheme.typography.titleMedium)}}
            items(rows,key={it.id}){r->
                Row(Modifier.fillMaxWidth().clickable{selected=if(r.id in selected)selected-r.id else selected+r.id}.padding(horizontal=18.dp,vertical=14.dp),verticalAlignment=Alignment.CenterVertically){
                    Checkbox(r.id in selected,{checked->selected=if(checked)selected+r.id else selected-r.id})
                    Text(r.name,Modifier.weight(1f).padding(start=10.dp))
                    if(products)Text(if(!s.stockLoaded||stockMap==null)"Stock unavailable"else (stockMap[r.id]?:java.math.BigDecimal.ZERO).setScale(1,java.math.RoundingMode.HALF_UP).toPlainString())
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
private fun UnitPicker(label:String,value:String,units:List<AccountMasterRecord>,enabled:Boolean=true,onChange:(String)->Unit){
    var open by remember{mutableStateOf(false)}
    ExposedDropdownMenuBox(expanded=open&&enabled,onExpandedChange={if(enabled)open=it}){
        OutlinedTextField(units.firstOrNull{it.id==value}?.name.orEmpty(),{},readOnly=true,enabled=enabled,label={Text(label)},modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),trailingIcon={ExposedDropdownMenuDefaults.TrailingIcon(open)})
        ExposedDropdownMenu(expanded=open&&enabled,onDismissRequest={open=false}){units.forEach{u->DropdownMenuItem({Text(u.name.uppercase())},{onChange(u.id);open=false})}}
    }
}
