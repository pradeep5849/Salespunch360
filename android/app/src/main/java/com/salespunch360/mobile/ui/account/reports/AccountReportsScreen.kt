package com.salespunch360.mobile.ui.account.reports

import android.content.Intent
import java.io.File
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountReportViewModel
import com.salespunch360.mobile.account.accountReportNames
import com.salespunch360.mobile.account.accountReportColumns
import com.salespunch360.mobile.account.accountReportRows
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.ui.account.accounting.Option
import kotlinx.serialization.json.*

@Composable
fun AccountReportsScreen(initial: String?, padding: PaddingValues, vm: AccountReportViewModel = viewModel(), initialQuery:String="") {
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
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp)) {
            item { Text("Account reports", style = MaterialTheme.typography.headlineSmall) }
            items(accountReportNames(state.options)) { report ->
                val name = report
                ListItem(headlineContent = { Text(name.replace('-', ' ').replaceFirstChar { it.uppercase() }) }, modifier = Modifier.clickable { vm.choose(name) })
            }
        }
        return
    }

    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
        TextButton(onClick = { vm.choose(null) }) { Text("‹ Reports hub") }
        Row {
            OutlinedTextField(state.from, { vm.dates(it, state.to) }, label = { Text("From") }, modifier = Modifier.weight(1f))
            OutlinedTextField(state.to, { vm.dates(state.from, it) }, label = { Text("To / as of") }, modifier = Modifier.weight(1f))
        }
        Row {
            Option("Branch", state.branchId, state.options.array("branches")) { vm.filter("branch", it) }
            Option("Project", state.projectId, state.options.array("projects")) { vm.filter("project", it) }
        }
        when (state.report) {
            "owner-capital", "profit-withdrawal" -> Option("Owner / Partner", state.ownerId, state.options.array("owners")) { vm.filter("owner", it) }
            "general-ledger" -> Option("Ledger", state.ledgerId, state.options.array("ledgers")) { vm.filter("ledger", it) }
            "customer-ledger" -> Option("Customer", state.customerId, state.options.array("customers")) { vm.filter("customer", it) }
            "vendor-ledger" -> Option("Vendor", state.vendorId, state.options.array("vendors")) { vm.filter("vendor", it) }
            "items" -> Option("Product", state.productId, state.options.array("products")) { vm.filter("product", it) }
        }
        Row {
            Button(onClick = vm::run) { Text("Run") }
            listOf("csv", "xlsx", "pdf").forEach { format -> TextButton(onClick = { vm.export(format) }) { Text(format.uppercase()) } }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.data?.let { data ->
            Text(data.str("title"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            data.str("note").takeIf { it.isNotBlank() }?.let { Text(it) }
            state.appliedFilters["from"]?.let { Text("Showing $it to ${state.appliedFilters["to"].orEmpty()}", style = MaterialTheme.typography.bodySmall) }
            LazyRow {
                item { Column { accountReportColumns(data).forEach { Text(it, fontWeight = FontWeight.Bold) } } }
                items(accountReportRows(data)) { row -> Column { row.forEach { Text(it) } } }
                data["totals"]?.jsonArray?.let { totals -> item { Column { totals.forEach { Text(it.jsonPrimitive.content, fontWeight = FontWeight.Bold) } } } }
            }
        }
    }
}
