package com.salespunch360.mobile.ui.account.reports

import android.content.Intent
import java.io.File
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountReportViewModel
import com.salespunch360.mobile.account.accountReportCatalogue
import com.salespunch360.mobile.account.accountReportFavourites
import com.salespunch360.mobile.account.accountReportColumns
import com.salespunch360.mobile.account.accountReportRows
import com.salespunch360.mobile.account.accountReportLinks
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.ui.account.accounting.Option
import kotlinx.serialization.json.*

@Composable
fun AccountReportsScreen(initial: String?, padding: PaddingValues, vm: AccountReportViewModel = viewModel(), initialQuery:String="", onNavigate:(String)->Unit={}) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    LaunchedEffect(initial,initialQuery) { vm.context(initialQuery); vm.choose(initial) }
    LaunchedEffect(state.export) {
        state.export?.let { export ->
            val file = File(context.cacheDir, export.first)
            file.writeBytes(export.second)
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
            val mime = when (export.first.substringAfterLast('.')) {
                "pdf" -> "application/pdf"
                "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                else -> "text/csv"
            }
            val send = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(send, "Share report"))
            vm.consumed()
        }
    }

    BackHandler(enabled=state.report!=null){vm.choose(null)}

    if (state.report == null) {
        var search by remember{mutableStateOf("")}
        val entries=accountReportCatalogue(state.options,search)
        val favourites=accountReportFavourites(state.options)
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp)) {
            item { Text("Account reports", style = MaterialTheme.typography.headlineSmall) }
            item {OutlinedTextField(search,{search=it},label={Text("Search reports")},modifier=Modifier.fillMaxWidth())}
            state.error?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}}
            val sections=buildList{val saved=entries.filter{it.key in favourites};if(saved.isNotEmpty())add("Favourites" to saved);addAll(entries.groupBy{it.group}.toList())}
            sections.forEach{(group,reports)->
                item(key="heading:$group"){Text(group,style=MaterialTheme.typography.titleMedium,modifier=Modifier.padding(vertical=12.dp))}
                items(reports,key={"$group:${it.key}"}) { report ->
                    ListItem(headlineContent={Text(report.name)},modifier=Modifier.clickable{vm.choose(report.key)},trailingContent={TextButton(onClick={vm.favourite(report.key,report.key !in favourites)},enabled=!state.favouriteSaving,modifier=Modifier.sizeIn(minWidth=48.dp,minHeight=48.dp).semantics{contentDescription="${if(report.key in favourites)"Remove"else"Add"} ${report.name} ${if(report.key in favourites)"from"else"to"} favourites"}){Text(if(report.key in favourites)"★"else"☆")}})
                }
            }
            if(entries.isEmpty())item{Text("No reports match your search.")}
        }
        return
    }

    val applicable=com.salespunch360.mobile.account.accountReportSpecificFilters(state.options,state.report.orEmpty())
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState())) {
        TextButton(onClick = { vm.choose(null) }) { Text("‹ Reports hub") }
        if(state.report !in listOf("projects","budget-vs-actual")){
        var periodOpen by remember{mutableStateOf(false)}
        Box{TextButton(onClick={periodOpen=true}){Text("Choose report period")};DropdownMenu(expanded=periodOpen,onDismissRequest={periodOpen=false}){listOf("TODAY" to "Today","THIS_MONTH" to "This month","LAST_MONTH" to "Last month","FINANCIAL_YEAR" to "Financial year").forEach{(key,label)->DropdownMenuItem(text={Text(label)},onClick={val range=com.salespunch360.mobile.account.accountReportPeriodBounds(key);vm.dates(range.first.toString(),range.second.toString());periodOpen=false})}}}
        Row {
            OutlinedTextField(state.from, { vm.dates(it, state.to) }, label = { Text("From") }, modifier = Modifier.weight(1f))
            OutlinedTextField(state.to, { vm.dates(state.from, it) }, label = { Text("To / as of") }, modifier = Modifier.weight(1f))
        }
        }else Text("Lifetime to date; date filters do not apply.")
        Row {
            Option("Branch", state.branchId, state.options.array("branches")) { vm.filter("branch", it) }
            if(applicable?.contains("projectId")!=false)Option("Project", state.projectId, state.options.array("projects")) { vm.filter("project", it) }
        }
        when (state.report) {
            "owner-capital", "profit-withdrawal" -> Option("Owner / Partner", state.ownerId, state.options.array("owners")) { vm.filter("owner", it) }
            "general-ledger" -> Option("Ledger", state.ledgerId, state.options.array("ledgers")) { vm.filter("ledger", it) }
            "customer-ledger" -> Option("Customer", state.customerId, state.options.array("customers")) { vm.filter("customer", it) }
            "vendor-ledger" -> Option("Vendor", state.vendorId, state.options.array("vendors")) { vm.filter("vendor", it) }
            "sale-report" -> Option("Customer",state.customerId,state.options.array("customers")){vm.filter("customer",it)}
            "purchase-report" -> Option("Vendor",state.vendorId,state.options.array("vendors")){vm.filter("vendor",it)}
            "items", "invoices", "customers" -> {
                Option("Customer", state.customerId, state.options.array("customers")) { vm.filter("customer", it) }
                Option("Product", state.productId, state.options.array("products")) { vm.filter("product", it) }
            }
        }
        Row {
            Button(onClick = vm::run) { Text("Run") }
            listOf("csv", "xlsx", "pdf").forEach { format -> TextButton(onClick = { vm.export(format) }) { Text(format.uppercase()) } }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.data?.let { data ->
            LazyRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){items(data.array("summary")){summary->Card{Column(Modifier.padding(12.dp)){Text(summary.str("label"));Text(summary.str("displayValue").ifBlank{summary.str("value")},fontWeight=FontWeight.Bold)}}}}
            Text(data.str("title"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            data.str("note").takeIf { it.isNotBlank() }?.let { Text(it) }
            state.appliedFilters["from"]?.let { Text("Showing $it to ${state.appliedFilters["to"].orEmpty()}", style = MaterialTheme.typography.bodySmall) }
            LazyRow {
                item { Column { accountReportColumns(data).forEach { Text(it, fontWeight = FontWeight.Bold) } } }
                itemsIndexed(accountReportRows(data)) { index, row -> val link=accountReportLinks(data).getOrNull(index)?.let{com.salespunch360.mobile.account.accountReportDestination(it)};Column(Modifier.clickable(enabled=link!=null){link?.let(onNavigate)}) { row.forEach { Text(it) } } }
                data["totals"]?.jsonArray?.let { totals -> item { Column { totals.forEach { Text(it.jsonPrimitive.content, fontWeight = FontWeight.Bold) } } } }
            }
            data.array("breakdown").forEach { group -> ReportLedgerGroup(group) }
        }
    }
}

@Composable
private fun ReportLedgerGroup(group: JsonObject) {
    var expanded by remember(group) { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            TextButton(onClick = { expanded = !expanded }) {
                Text("${if (expanded) "Hide" else "Show"} ${group.str("title")} — ${group.str("total")}")
            }
            if (expanded) {
                val rows = group.array("rows")
                if (rows.isEmpty()) Text("No ledger balances in this section.")
                if (rows.isNotEmpty()) LazyColumn(Modifier.fillMaxWidth().heightIn(max = 360.dp)) { items(rows) { row -> Text("${row.str("code")} ${row.str("name")} — ${row.str("amount")}") } }
            }
        }
    }
}
