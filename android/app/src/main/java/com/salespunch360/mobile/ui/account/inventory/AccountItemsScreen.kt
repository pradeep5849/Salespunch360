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
import kotlinx.serialization.json.*

@Composable fun AccountItemsScreen(padding:PaddingValues,canSettings:Boolean,navigate:(String)->Unit,vm:AccountInventoryViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;var query by remember{mutableStateOf("")};LaunchedEffect(Unit){vm.show("stock")}
 LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Items",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
  item{ElevatedCard{Column(Modifier.padding(14.dp)){Text("Quick Links",fontWeight=FontWeight.Bold);Row(Modifier.fillMaxWidth()){Quick("Online Store",Icons.Default.Storefront,Modifier.weight(1f)){navigate("/workspace/account/inventory/online-store")};Quick("Stock Summary",Icons.Default.Assessment,Modifier.weight(1f)){navigate("/workspace/account/inventory/stock-summary")};if(canSettings)Quick("Item Settings",Icons.Default.Settings,Modifier.weight(1f)){navigate("/workspace/account/inventory/item-settings")};Quick("Show All",Icons.Default.Apps,Modifier.weight(1f)){navigate("/workspace/account/inventory/items")}}}}}
  item{OutlinedTextField(query,{query=it},leadingIcon={Icon(Icons.Default.Search,null)},label={Text("Search for an item or code")},singleLine=true,modifier=Modifier.fillMaxWidth())}
  if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}}
  val rows=state.rows.filter{row->val product=row["product"]?.jsonObject;listOf(product?.text("name"),product?.text("code")).any{it.orEmpty().contains(query,true)}}
  items(rows){row->val product=row["product"]?.jsonObject?:return@items;val quantity=row.text("quantity").toDoubleOrNull()?:0.0;ElevatedCard{Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(product.text("name"),fontWeight=FontWeight.Bold);product["category"]?.jsonObject?.text("name")?.takeIf{it.isNotBlank()}?.let{AssistChip({},label={Text(it)})}};Text(product.text("code"),style=MaterialTheme.typography.bodySmall);Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Sale ₹${product.text("salePrice")}");Text("Purchase ₹${product.text("costPrice")}");Text("Stock ${"%.2f".format(quantity)}",color=if(quantity<0)Color(0xFFDC2626) else MaterialTheme.colorScheme.onSurface)}}}}}
  item{Button(onClick={navigate("/workspace/account/inventory/items")},modifier=Modifier.fillMaxWidth()){Icon(Icons.Default.Add,null);Text(" Add New Item")}}
 }
}
@Composable private fun Quick(label:String,icon:androidx.compose.ui.graphics.vector.ImageVector,modifier:Modifier,onClick:()->Unit){Column(modifier.clickable(onClick=onClick).padding(6.dp),horizontalAlignment=Alignment.CenterHorizontally){Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFEFF6FF)){Icon(icon,label,Modifier.padding(10.dp),tint=Color(0xFF2563EB))};Text(label,style=MaterialTheme.typography.labelSmall,maxLines=2)}}
@Composable fun OnlineStoreScreen(padding:PaddingValues,back:()->Unit){Column(Modifier.fillMaxSize().padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){TextButton(back){Text("← Items")};Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF0B4FA4))){Column(Modifier.padding(24.dp)){Text("SalesPunch360 Online",color=Color(0xFFFFB16F));Text("Your next customer could be anywhere.",color=Color.White,style=MaterialTheme.typography.headlineSmall);Text("Build an online presence for your catalogue when Online Store launches.",color=Color.White)}};listOf("Grow income","Get customers online","Get more orders").forEach{ListItem(headlineContent={Text(it,fontWeight=FontWeight.Bold)})};Button({},enabled=false,modifier=Modifier.fillMaxWidth()){Text("Create Online Store · Coming Soon")}}}
private fun JsonObject.text(key:String)=get(key)?.jsonPrimitive?.contentOrNull.orEmpty()
