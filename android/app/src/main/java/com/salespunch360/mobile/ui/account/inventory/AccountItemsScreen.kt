package com.salespunch360.mobile.ui.account.inventory

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountInventoryViewModel
import com.salespunch360.mobile.data.AccountMasterRecord
import kotlinx.serialization.json.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountItemsScreen(
    padding:PaddingValues,
    canSettings:Boolean,
    navigate:(String)->Unit,
    vm:AccountInventoryViewModel=viewModel()
){
    val state=vm.state.collectAsStateWithLifecycle().value
    var query by remember{mutableStateOf("")}
    var filterOpen by remember{mutableStateOf(false)}
    var moreOpen by remember{mutableStateOf(false)}
    var types by remember{mutableStateOf(setOf<String>())}
    var categories by remember{mutableStateOf(setOf<String>())}
    var draftTypes by remember{mutableStateOf(setOf<String>())}
    var draftCategories by remember{mutableStateOf(setOf<String>())}
    LaunchedEffect(Unit){vm.show("stock")}

    val stockById=remember(state.rows){
        state.rows.associate{row->
            val product=row["product"]?.jsonObject
            product?.get("id")?.jsonPrimitive?.content.orEmpty() to (row["quantity"]?.jsonPrimitive?.content?.toDoubleOrNull()?:0.0)
        }
    }
    data class DisplayItem(val kind:String,val record:AccountMasterRecord,val stock:Double?)
    val allItems=remember(state.itemRecords,state.serviceRecords,state.rows){
        buildList{
            state.itemRecords.forEach{add(DisplayItem("PRODUCT",it,stockById[it.id]?:0.0))}
            state.serviceRecords.forEach{add(DisplayItem("SERVICE",it,null))}
        }.sortedBy{it.record.name.lowercase()}
    }
    val shown=allItems.filter{item->
        val search="${item.record.name} ${item.record.code.orEmpty()}".contains(query,true)
        val typeOk=types.isEmpty()||item.kind in types
        val categoryOk=categories.isEmpty()||item.record.categoryId in categories
        search&&typeOk&&categoryOk
    }
    val categoryOptions=state.options["categories"]?.jsonArray?.mapNotNull{it.jsonObject}.orEmpty()

    Box(Modifier.fillMaxSize().padding(padding)){
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding=PaddingValues(start=16.dp,top=16.dp,end=16.dp,bottom=100.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)
        ){
            item{Text("Items",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
            item{
                ElevatedCard{
                    Column(Modifier.padding(14.dp)){
                        Text("Quick Links",fontWeight=FontWeight.Bold)
                        Row(Modifier.fillMaxWidth()){
                            Quick("Online Store",Icons.Default.Storefront,Modifier.weight(1f)){navigate("/workspace/account/inventory/online-store")}
                            Quick("Stock Summary",Icons.Default.Assessment,Modifier.weight(1f)){navigate("/workspace/account/inventory/stock-summary")}
                            if(canSettings)Quick("Item Settings",Icons.Default.Settings,Modifier.weight(1f)){navigate("/workspace/account/inventory/item-settings")}
                            Quick("Show All",Icons.Default.Apps,Modifier.weight(1f)){navigate("/workspace/account/inventory/items")}
                        }
                    }
                }
            }
            item{
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    OutlinedTextField(
                        query,{query=it},
                        leadingIcon={Icon(Icons.Default.Search,null)},
                        placeholder={Text("Search for an item or code")},
                        singleLine=true,
                        modifier=Modifier.weight(1f),
                        trailingIcon={IconButton(onClick={draftTypes=types;draftCategories=categories;filterOpen=true}){Icon(Icons.Default.FilterList,"Filter")}}
                    )
                    OutlinedIconButton(onClick={moreOpen=true},modifier=Modifier.size(56.dp)){Icon(Icons.Default.MoreVert,"More options")}
                }
            }
            if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
            state.error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}}
            if(!state.loading&&shown.isEmpty())item{
                Box(Modifier.fillMaxWidth().height(210.dp),contentAlignment=Alignment.Center){
                    Column(horizontalAlignment=Alignment.CenterHorizontally){Text("No items found",fontWeight=FontWeight.Bold);Text("Try another item name, code or category.",color=Color(0xFF64748B))}
                }
            }
            items(shown,key={it.record.id}){item->
                val r=item.record
                ElevatedCard(Modifier.fillMaxWidth()){
                    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                            Text(r.name,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
                            r.categoryId?.let{id->categoryOptions.firstOrNull{it["id"]?.jsonPrimitive?.content==id}?.get("name")?.jsonPrimitive?.contentOrNull?.let{name->AssistChip({},label={Text(name)})}}
                        }
                        if(!r.code.isNullOrBlank())Text(r.code.orEmpty(),style=MaterialTheme.typography.bodySmall,color=Color(0xFF64748B))
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                            Column{Text("Sale Price",style=MaterialTheme.typography.labelSmall,color=Color(0xFF94A3B8));Text("₹${r.salePrice.orEmpty().ifBlank{"0.00"}}")}
                            Column{Text("Purchase Price",style=MaterialTheme.typography.labelSmall,color=Color(0xFF94A3B8));Text("₹${r.costPrice.orEmpty().ifBlank{"0.00"}}")}
                            Column{Text(if(item.kind=="PRODUCT")"In Stock" else "Type",style=MaterialTheme.typography.labelSmall,color=Color(0xFF94A3B8));Text(item.stock?.let{"%.2f".format(it)}?:"Service",color=if((item.stock?:0.0)<0)Color(0xFFDC2654) else MaterialTheme.colorScheme.onSurface)}
                        }
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick={navigate("/workspace/account/inventory/items/new")},
            icon={Icon(Icons.Default.Add,null)},
            text={Text("Add New Item")},
            modifier=Modifier.align(Alignment.BottomEnd).padding(16.dp)
        )
    }

    if(filterOpen)ModalBottomSheet(onDismissRequest={filterOpen=false},dragHandle=null){
        Column(Modifier.fillMaxWidth().heightIn(max=680.dp)){
            Row(Modifier.fillMaxWidth().padding(18.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                Text("Filter By",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                IconButton(onClick={filterOpen=false}){Icon(Icons.Default.Close,"Close")}
            }
            LazyColumn(Modifier.weight(1f)){
                item{FilterRow("Products","PRODUCT" in draftTypes){checked->draftTypes=if(checked)draftTypes+"PRODUCT" else draftTypes-"PRODUCT"}}
                item{FilterRow("Services","SERVICE" in draftTypes){checked->draftTypes=if(checked)draftTypes+"SERVICE" else draftTypes-"SERVICE"}}
                item{Text("Categories",style=MaterialTheme.typography.headlineSmall,modifier=Modifier.padding(18.dp))}
                items(categoryOptions,key={it["id"]?.jsonPrimitive?.content.orEmpty()}){cat->
                    val id=cat["id"]?.jsonPrimitive?.content.orEmpty()
                    val label=cat["name"]?.jsonPrimitive?.content.orEmpty()
                    FilterRow(label,id in draftCategories){checked->draftCategories=if(checked)draftCategories+id else draftCategories-id}
                }
            }
            Surface(shadowElevation=6.dp){
                Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){
                    OutlinedButton(onClick={draftTypes=emptySet();draftCategories=emptySet()},Modifier.weight(1f).height(54.dp)){Text("Clear")}
                    Button(onClick={types=draftTypes;categories=draftCategories;filterOpen=false},Modifier.weight(1f).height(54.dp)){Text("Apply")}
                }
            }
        }
    }

    if(moreOpen)ModalBottomSheet(onDismissRequest={moreOpen=false},dragHandle=null){
        Column(Modifier.fillMaxWidth().padding(bottom=24.dp)){
            Row(Modifier.fillMaxWidth().padding(18.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                Text("More Options",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                IconButton(onClick={moreOpen=false}){Icon(Icons.Default.Close,"Close")}
            }
            listOf(
                "Mark Items Active" to "/workspace/account/inventory/active?mode=activate",
                "Mark Items Inactive" to "/workspace/account/inventory/active?mode=deactivate",
                "Units" to "/workspace/account/inventory/units",
                "Categories" to "/workspace/account/inventory/categories"
            ).forEach{(label,path)->
                ListItem(headlineContent={Text(label)},trailingContent={Icon(Icons.Default.ChevronRight,null)},modifier=Modifier.clickable{moreOpen=false;navigate(path)})
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun FilterRow(label:String,checked:Boolean,onChange:(Boolean)->Unit){
    Row(Modifier.fillMaxWidth().clickable{onChange(!checked)}.padding(horizontal=18.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
        Text(label,style=MaterialTheme.typography.titleMedium)
        Checkbox(checked,onChange)
    }
}
@Composable private fun Quick(label:String,icon:androidx.compose.ui.graphics.vector.ImageVector,modifier:Modifier,onClick:()->Unit){Column(modifier.clickable(onClick=onClick).padding(6.dp),horizontalAlignment=Alignment.CenterHorizontally){Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFEFF6FF)){Icon(icon,label,Modifier.padding(10.dp),tint=Color(0xFF2563EB))};Text(label,style=MaterialTheme.typography.labelSmall,maxLines=2)}}
@Composable fun OnlineStoreScreen(padding:PaddingValues,back:()->Unit){Column(Modifier.fillMaxSize().padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){TextButton(back){Text("← Items")};Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF0B4FA4))){Column(Modifier.padding(24.dp)){Text("SalesPunch360 Online",color=Color(0xFFFFB16F));Text("Your next customer could be anywhere.",color=MaterialTheme.colorScheme.onPrimary,style=MaterialTheme.typography.headlineSmall);Text("Build an online presence for your catalogue when Online Store launches.",color=MaterialTheme.colorScheme.onPrimary)}};listOf("Grow income","Get customers online","Get more orders").forEach{ListItem(headlineContent={Text(it,fontWeight=FontWeight.Bold)})};Button({},enabled=false,modifier=Modifier.fillMaxWidth()){Text("Create Online Store · Coming Soon")}}}
