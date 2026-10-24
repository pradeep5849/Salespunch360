package com.salespunch360.mobile.ui.account.inventory

import android.content.Intent
import java.io.File
import java.math.RoundingMode
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountStockSummaryViewModel
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.ui.account.accountMoney
import com.salespunch360.mobile.ui.account.LocalAccountDisplayPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

@Composable fun StockSummaryScreen(padding:PaddingValues,initialQuery:String="",vm:AccountStockSummaryViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 val context=LocalContext.current;val display=LocalAccountDisplayPreferences.current
 LaunchedEffect(initialQuery){vm.context(initialQuery)}
 LaunchedEffect(state.export){state.export?.let{export->
  try{
   val file=withContext(Dispatchers.IO){File(context.cacheDir,export.first).apply{writeBytes(export.second)}}
   val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
   val mime=if(export.first.endsWith(".pdf"))"application/pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
   context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share stock summary"))
   vm.consumed()
  }catch(e:kotlinx.coroutines.CancellationException){throw e}catch(_:Exception){vm.shareFailed()}
 }}
 val rows=state.data?.array("filtered").orEmpty()
 val categories=state.data?.array("rows").orEmpty().map{it.str("category")}.distinct().sorted()
 val metrics=com.salespunch360.mobile.account.stockSummaryMetrics(rows)
 LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Stock Summary",style=MaterialTheme.typography.headlineSmall)}
  item{OutlinedTextField(state.filters["q"].orEmpty(),{vm.filter("q",it)},label={Text("Search stock")},modifier=Modifier.fillMaxWidth())}
  item{OutlinedTextField(state.filters["asOf"].orEmpty(),{vm.filter("asOf",it)},label={Text("Stock as-of date (YYYY-MM-DD)")},supportingText={Text("Leave blank for current stock.")},modifier=Modifier.fillMaxWidth())}
  item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){StockChoice("Item category",state.filters["category"].orEmpty(),listOf("" to "All categories")+categories.map{it to it},Modifier.weight(1f)){vm.filter("category",it)};StockChoice("Item status",state.filters["status"].orEmpty(),listOf("" to "All statuses","true" to "Active","false" to "Inactive"),Modifier.weight(1f)){vm.filter("status",it)}}}
  item{StockChoice("Stock level",state.filters["level"].orEmpty(),listOf("" to "All stock levels","available" to "Available","low" to "Low stock","negative" to "Negative"),Modifier.fillMaxWidth()){vm.filter("level",it)}}
  item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button(vm::run,enabled=!state.loading){Text("Apply")};TextButton(vm::reset,enabled=!state.loading){Text("Reset filters")}}}
  item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("pdf","xlsx").forEach{format->TextButton({vm.export(format)},enabled=state.appliedFilters!=null&&!state.loading&&!state.exporting){Text(format.uppercase())}}}}
  if(state.loading||state.exporting)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  state.error?.let{error->item{Text(error,color=MaterialTheme.colorScheme.error);TextButton(vm::run){Text("Retry")}}}
  state.appliedFilters?.let{filters->item{Text("Showing ${filters["asOf"]?:"current stock"} · ${state.data?.get("context")?.jsonObject?.str("branchName")?.ifBlank{null}?:"All authorized branches"}",style=MaterialTheme.typography.bodySmall)}}
  if(state.data!=null){
   item{ElevatedCard{Column(Modifier.padding(12.dp)){Text("Number of Items: ${metrics.itemCount}");Text("Low Stock Items: ${metrics.lowStockCount}");Text("Total Stock Value: ${accountMoney(metrics.value)}")}}}
   if(rows.isEmpty())item{Text(if(state.data?.array("rows").isNullOrEmpty())"No inventory items are available in this branch." else "No stock items match these filters.")}
  }
  items(rows,key={it.str("id")}){row->ElevatedCard{Column(Modifier.fillMaxWidth().padding(12.dp)){Text(row.str("name"),style=MaterialTheme.typography.titleMedium);Text(row.str("category"));if(row["active"]?.jsonPrimitive?.booleanOrNull==false)Text("Inactive");Text("Stock quantity: ${row.str("quantity").toBigDecimalOrNull()?.setScale(display.decimals,RoundingMode.HALF_UP)?.toPlainString()?:row.str("quantity")}");Text("Stock value: ${accountMoney(row.str("value"))}")}}}
 }
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun StockChoice(label:String,value:String,options:List<Pair<String,String>>,modifier:Modifier,onSelect:(String)->Unit){
 var open by remember{mutableStateOf(false)}
 ExposedDropdownMenuBox(open,{open=it},modifier){OutlinedTextField(options.firstOrNull{it.first==value}?.second.orEmpty(),{},readOnly=true,label={Text(label)},modifier=Modifier.menuAnchor().fillMaxWidth());ExposedDropdownMenu(open,{open=false}){options.forEach{option->DropdownMenuItem({Text(option.second)},{onSelect(option.first);open=false})}}}
}
