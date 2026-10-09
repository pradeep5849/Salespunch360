package com.salespunch360.mobile.ui.account.project

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.*
import com.salespunch360.mobile.account.*
import kotlinx.serialization.json.*

private fun workflowStatus(status: String) = when (status) {
    "ON_HOLD" -> "ON_HOLD"
    "COMPLETED", "CLOSED", "CANCELLED" -> "COMPLETED"
    else -> "ACTIVE"
}

private val projectStatusFilters = listOf<String?>(null, "ACTIVE", "ON_HOLD", "COMPLETED")

private fun workflowStatusLabel(status: String) = when (workflowStatus(status)) {
    "ON_HOLD" -> "Hold"
    "COMPLETED" -> "Completed"
    else -> "Active"
}

@Composable
fun ProjectScreen(
    padding: PaddingValues,
    navigate:(String)->Unit={},
    initialProjectId:String?=null,
    initialCreate:Boolean=false,
    vm: AccountProjectViewModel = viewModel(),
) {
    LaunchedEffect(initialProjectId,initialCreate){vm.initialRoute(initialProjectId,initialCreate)}
    val s = vm.state.collectAsStateWithLifecycle().value
    Box(Modifier.fillMaxSize().padding(padding)) {
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding=PaddingValues(start=14.dp,end=14.dp,top=14.dp,bottom=104.dp),
            verticalArrangement=Arrangement.spacedBy(14.dp)
        ) {
            item { Text("Projects",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold) }
            item {
                Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        ProjectMetric("Active Projects",s.metrics["activeProjects"]?.jsonPrimitive?.content?:"0",Modifier.weight(1f))
                        ProjectMetric("Projects Closed",s.metrics["projectsClosed"]?.jsonPrimitive?.content?:"0",Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        ProjectMetric("Received","₹${s.metrics["received"]?.jsonPrimitive?.content?:"0"}",Modifier.weight(1f))
                        ProjectMetric("Outstanding","₹${s.metrics["outstanding"]?.jsonPrimitive?.content?:"0"}",Modifier.weight(1f))
                    }
                    ProjectMetric("Total Project Value","₹${s.metrics["totalProjectValue"]?.jsonPrimitive?.content?:"0"}",Modifier.fillMaxWidth())
                }
            }
            item {
                ElevatedCard(colors=CardDefaults.elevatedCardColors(containerColor=MaterialTheme.colorScheme.surface)){
                    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                        Text("Quick Links",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(4.dp)){
                            listOf(
                                Triple("Project Invoice",Icons.Default.ReceiptLong,"/workspace/account/transactions/new?type=SALES_INVOICE&project=select"),
                                Triple("Move / Return Stock",Icons.Default.Inventory2,"/workspace/account/projects/material"),
                                Triple("Project Settings",Icons.Default.Settings,"/workspace/account/settings/modules"),
                                Triple("View All",Icons.Default.Apps,"/workspace/account/projects/actions")
                            ).forEach{(label,icon,path)->
                                Column(
                                    Modifier.weight(1f).clickable{navigate(path)}.padding(vertical=8.dp,horizontal=2.dp),
                                    horizontalAlignment=androidx.compose.ui.Alignment.CenterHorizontally,
                                    verticalArrangement=Arrangement.spacedBy(5.dp)
                                ){
                                    Surface(shape=MaterialTheme.shapes.medium,color=MaterialTheme.colorScheme.primaryContainer){Icon(icon,label,Modifier.padding(9.dp),tint=MaterialTheme.colorScheme.primary)}
                                    Text(label,style=MaterialTheme.typography.labelSmall,maxLines=2)
                                }
                            }
                        }
                    }
                }
            }
            item {
                OutlinedTextField(s.query,vm::search,label={Text("Search projects")},modifier=Modifier.fillMaxWidth(),singleLine=true,leadingIcon={Icon(Icons.Default.Search,null)})
            }
            item { Text("All Projects",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold) }
            if(s.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
            s.error?.let { error -> item { Text(error,color=MaterialTheme.colorScheme.error) } }
            items(s.rows,key={it.str("id")}){row->
                ElevatedCard(Modifier.fillMaxWidth().clickable{vm.open(row.str("id"))}){
                    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                            Column(Modifier.weight(1f)){Text(row.str("name"),fontWeight=FontWeight.Bold);Text(row["customer"]?.jsonObject?.str("name").orEmpty(),style=MaterialTheme.typography.bodySmall)}
                            Text(workflowStatusLabel(row.str("status")),style=MaterialTheme.typography.labelMedium)
                        }
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                            Text("Value ₹${row.str("finalProjectValue").ifBlank{row.str("projectValue")}}",style=MaterialTheme.typography.bodySmall)
                            Text("Received ₹${row.str("received").ifBlank{row.str("customerPayments")}}",style=MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick=vm::create,
            text={Text("Create New Project")},
            icon={Icon(Icons.Default.Add,"Create")},
            modifier=Modifier.align(androidx.compose.ui.Alignment.BottomEnd).padding(16.dp)
        )
    }
    s.editing?.let { ProjectEditor(it, s.options, s.saving, s.error, vm::close, vm::save) }
    s.detail?.let {
        ProjectDetail(it,s.costing,s.options["capabilities"]?.jsonObject?.get("budgetEdit")?.jsonPrimitive?.booleanOrNull==true,s.saving,s.error,vm::close,vm::edit,vm::action,vm::editBudget,vm::editChange,vm::transitionChange)
    }
    s.changeEditing?.let { ChangeOrderDialog(it,s.saving,s.error,vm::closeChange,vm::updateChange,vm::saveChange) }
    if (s.budgetEditing && s.detail != null) {
        BudgetDialog(s.detail!!, s.saving, s.error, { vm.editBudget(false) }, vm::saveBudget)
    }
}

@Composable
private fun ProjectMetric(label:String,value:String,modifier:Modifier=Modifier){
    ElevatedCard(modifier,colors=CardDefaults.elevatedCardColors(containerColor=MaterialTheme.colorScheme.surface)){
        Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=14.dp),horizontalArrangement=Arrangement.SpaceBetween){
            Text(label,style=MaterialTheme.typography.labelSmall)
            Text(value,fontWeight=FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectEditor(
    x: JsonObject,
    options: JsonObject,
    saving: Boolean,
    error: String?,
    close: () -> Unit,
    save: (JsonObject) -> Unit,
) {
    val edit = x.containsKey("id")
    val caps = options["capabilities"]?.jsonObject
    val managerEditable = caps?.get("managerEditable")?.jsonPrimitive?.booleanOrNull == true
    var name by remember { mutableStateOf(x.str("name")) }
    var branch by remember { mutableStateOf(x.str("branchId")) }
    var manager by remember { mutableStateOf(x.str("projectManagerId")) }
    var value by remember { mutableStateOf(x.str("projectValue").ifBlank { "0" }) }
    var siteName by remember { mutableStateOf(x.str("siteName")) }
    var siteAddress by remember { mutableStateOf(x.str("siteAddress")) }
    var siteContactName by remember { mutableStateOf(x.str("siteContactName")) }
    var siteContactPhone by remember { mutableStateOf(x.str("siteContactPhone")) }
    var start by remember { mutableStateOf(x.str("startDate").take(10)) }
    var status by remember { mutableStateOf(workflowStatus(x.str("status"))) }

    AlertDialog(
        onDismissRequest = {if(!saving)close()},
        title = { Text(if (edit) "Edit project" else "New project") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                error?.let { message -> item { Text(message,color=MaterialTheme.colorScheme.error) } }
                item { OutlinedTextField(name, { name = it }, label = { Text("Project name") },enabled=!saving) }
                if (!edit) {
                    item { Pick("Branch", branch, options.array("branches"),enabled=!saving) { branch = it; manager = "" } }
                }
                if (managerEditable) item { Pick("Project manager", manager, options.array("managers").filter { element ->
                    val row=element.jsonObject
                    row.str("branchAccessScope")=="ALL_BRANCHES" || row.array("branchAccesses").any { it.jsonObject.str("branchId")==branch }
                },enabled=!saving) { manager = it } }
                else item { Text("Project manager: assigned to you") }
                item { OutlinedTextField(value, { value = it }, label = { Text("Project value") },enabled=!saving) }
                item { OutlinedTextField(siteName, { siteName = it }, label = { Text("Site name") },enabled=!saving) }
                item { OutlinedTextField(siteAddress, { siteAddress = it }, label = { Text("Site address") },enabled=!saving) }
                item { OutlinedTextField(siteContactName, { siteContactName = it }, label = { Text("Site contact") },enabled=!saving) }
                item { OutlinedTextField(siteContactPhone, { siteContactPhone = it }, label = { Text("Mobile number") },enabled=!saving) }
                item { OutlinedTextField(start, { start = it }, label = { Text("Start date") },enabled=!saving) }
                if (edit) {
                    item {
                        PickText(
                            "Status",
                            status,
                            listOf("ACTIVE", "ON_HOLD"),
                            enabled=!saving,
                        ) { status = it }
                    }
                } else {
                    item { Text("Status: Active") }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !saving && name.trim().length in 1..240 && (edit || branch.isNotBlank()) &&
                    Regex("^[0-9]{1,16}(\\.[0-9]{1,2})?$").matches(value) && siteName.length<=240 && siteAddress.length<=4000 &&
                    siteContactName.length<=160 && siteContactPhone.length<=30 &&
                    (start.isBlank() || runCatching { java.time.LocalDate.parse(start) }.isSuccess),
                onClick = {
                    save(
                        buildJsonObject {
                            if (edit) {
                                put("projectId", x.str("id"))
                                put("status", status)
                            } else {
                                put("branchId", branch)
                            }
                            put("name", name)
                            (if(managerEditable)manager else caps?.str("actorId").orEmpty()).takeIf { it.isNotBlank() }?.let { put("projectManagerId", it) }
                            siteName.takeIf { it.isNotBlank() }?.let { put("siteName", it) }
                            siteAddress.takeIf { it.isNotBlank() }?.let { put("siteAddress", it) }
                            siteContactName.takeIf { it.isNotBlank() }?.let { put("siteContactName", it) }
                            siteContactPhone.takeIf { it.isNotBlank() }?.let { put("siteContactPhone", it) }
                            start.takeIf { it.isNotBlank() }?.let { put("startDate", it) }
                            put("projectValue", value)
                        },
                    )
                },
            ) { Text(if(saving)"Saving…" else "Save") }
        },
        dismissButton = { TextButton(close,enabled=!saving) { Text("Cancel") } },
    )
}

@Composable
private fun ProjectDetail(
    x: JsonObject,
    costing: JsonObject?,
    canBudget: Boolean,
    saving: Boolean,
    error: String?,
    close: () -> Unit,
    edit: () -> Unit,
    action: (String, String) -> Unit,
    budget: () -> Unit,
    editChange: (JsonObject?) -> Unit,
    transitionChange: (String, String) -> Unit,
) {
    val final = workflowStatus(x.str("status")) == "COMPLETED"
    AlertDialog(
        onDismissRequest = close,
        title = { Text(x.str("projectNumber")) },
        text = {
            LazyColumn {
                error?.let { message -> item { Text(message,color=MaterialTheme.colorScheme.error) } }
                item { Text(x.str("name"), style = MaterialTheme.typography.titleLarge) }
                item {
                    Text(
                        "${x["customer"]?.jsonObject?.str("name")} · ${x["branch"]?.jsonObject?.str("name")}",
                    )
                }
                item { Text("Status ${workflowStatusLabel(x.str("status"))} · Value ₹${x.str("projectValue")}") }
                x.str("siteAddress").takeIf { it.isNotBlank() }?.let { address ->
                    item { Text("Site: $address") }
                }
                x.str("siteContactPhone").takeIf { it.isNotBlank() }?.let { phone ->
                    item { Text("Mobile: $phone") }
                }
                if (final) {
                    item {
                        Text(
                            "Completed project · report only",
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                item {
                    Text(
                        "Customer received ₹${x.str("customerPayments")} · Vendor paid ₹${x.str("vendorPayments")}",
                    )
                }
                item { Text("Open tasks ${x.str("openTasks")}") }
                x.str("sourceQuotationId").takeIf { it.isNotBlank() }?.let { quotation ->
                    item { Text("Created from accepted quotation · $quotation") }
                }
                costing?.get("metrics")?.jsonObject?.let { metrics ->
                    item { Text("Project report / costing", style = MaterialTheme.typography.titleMedium) }
                    listOf(
                        "originalValue", "approvedChangeOrders", "contractRevenueBase", "estimatedCost",
                        "actualCost", "committedCost", "remainingForecast", "forecastCost", "budgetVariance",
                        "revenue", "profit", "expectedProfit", "forecastProfit", "finalProfit",
                        "advanceReceived", "amountReceived", "accountingReceivable",
                        "inventoryMaterialIssued", "materialConsumed", "materialUnused", "materialReturned",
                        "materialTransferredIn", "materialTransferredOut", "actualMarginPercent", "expectedMarginPercent", "forecastMarginPercent",
                    ).forEach { key ->
                        item {
                            ListItem(
                                headlineContent = {
                                    Text(key.replace(Regex("([A-Z])"), " $1"))
                                },
                                trailingContent = { Text(metrics.str(key)) },
                            )
                        }
                    }
                }
                costing?.let { report ->
                    val caps = report["capabilities"]?.jsonObject
                    val canEdit = !final && caps?.get("edit")?.jsonPrimitive?.booleanOrNull == true
                    val canApprove = caps?.get("approve")?.jsonPrimitive?.booleanOrNull == true
                    val actorId = caps?.str("actorId")
                    item { Text("Change Orders / Extra Work",style=MaterialTheme.typography.titleMedium) }
                    if (canEdit) item { OutlinedButton(onClick={editChange(null)},enabled=!saving) { Text("Add extra work") } }
                    items(report.array("changes"),key={it.jsonObject.str("id")}) { element ->
                        val row = element.jsonObject
                        Column(verticalArrangement=Arrangement.spacedBy(6.dp)) {
                            Text("${row.str("changeOrderNumber")} · ${row.str("title")}")
                            Text("${row.str("status")} · Value ${row.str("valueDelta")} · Estimated cost ${row.str("estimatedCostDelta")}")
                            if (canEdit && row.str("status")=="DRAFT") {
                                Row { TextButton(onClick={editChange(row)},enabled=!saving){Text("Edit draft")};TextButton(onClick={transitionChange(row.str("id"),"PENDING_APPROVAL")},enabled=!saving){Text("Submit")} }
                            }
                            if (canEdit && row.str("status")=="PENDING_APPROVAL" && canApprove && row.str("createdById")!=actorId) {
                                Row { TextButton(onClick={transitionChange(row.str("id"),"APPROVED")},enabled=!saving){Text("Approve")};TextButton(onClick={transitionChange(row.str("id"),"REJECTED")},enabled=!saving){Text("Reject")} }
                            }
                            if (canEdit && row.str("status") in listOf("DRAFT","PENDING_APPROVAL")) TextButton(onClick={transitionChange(row.str("id"),"CANCELLED")},enabled=!saving){Text("Cancel change order")}
                        }
                    }
                }
                costing?.array("packages")?.let { packages ->
                    item { Text("Package profitability", style = MaterialTheme.typography.titleMedium) }
                    items(packages) { element ->
                        val row = element.jsonObject
                        ListItem(
                            headlineContent = { Text(row.str("name")) },
                            supportingContent = {
                                Text("Revenue ${row.str("actualRevenue")} · Cost ${row.str("actualCost")}")
                            },
                            trailingContent = { Text("Profit ${row.str("profit")}") },
                        )
                    }
                }
                item { Text("Related documents", style = MaterialTheme.typography.titleMedium) }
                items(x.array("commercialDocuments")) { document ->
                    val row = document.jsonObject
                    Text("${row.str("documentNumber")} · ${row.str("type")} · ${row.str("status")}")
                }
            }
        },
        confirmButton = {
            if (!final) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Button(edit,enabled=!saving) { Text("Edit") }
                    if (canBudget) OutlinedButton(budget,enabled=!saving) { Text("Budget") }
                    FilledTonalButton({ action(x.str("id"), "COMPLETE") },enabled=!saving) {
                        Text("Complete")
                    }
                }
            }
        },
        dismissButton = { TextButton(close) { Text("Close") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Pick(
    label: String,
    value: String,
    values: List<JsonElement>,
    enabled: Boolean = true,
    set: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val selected = values.map { it.jsonObject }.firstOrNull { it.str("id") == value }
    ExposedDropdownMenuBox(open && enabled, { if(enabled)open = it }) {
        OutlinedTextField(
            selected?.str("name").orEmpty(),
            {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            modifier = Modifier.menuAnchor(),
        )
        ExposedDropdownMenu(open && enabled, { open = false }) {
            values.forEach { element ->
                val row = element.jsonObject
                DropdownMenuItem(
                    { Text(row.str("name")) },
                    {
                        set(row.str("id"))
                        open = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickText(
    label: String,
    value: String,
    values: List<String>,
    enabled: Boolean = true,
    set: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val visible = when (value) {
        "ON_HOLD" -> "Hold"
        else -> "Active"
    }
    ExposedDropdownMenuBox(open && enabled, { if(enabled)open = it }) {
        OutlinedTextField(
            visible,
            {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            modifier = Modifier.menuAnchor(),
        )
        ExposedDropdownMenu(open && enabled, { open = false }) {
            values.forEach { option ->
                DropdownMenuItem(
                    { Text(if (option == "ON_HOLD") "Hold" else "Active") },
                    {
                        set(option)
                        open = false
                    },
                )
            }
        }
    }
}

@Composable
private fun BudgetDialog(
    project: JsonObject,
    saving: Boolean,
    error: String?,
    close: () -> Unit,
    save: (String, List<ProjectBudgetLineDraft>) -> Unit,
) {
    var lines by remember(project.str("id")) { mutableStateOf(projectBudgetLines(project)) }
    AlertDialog(
        onDismissRequest = { if (!saving) close() },
        title = { Text("Project budget") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                error?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.error) } }
                itemsIndexed(lines) { index, row ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Budget line ${index + 1}", fontWeight = FontWeight.Bold)
                        OutlinedTextField(row.category, { value -> lines = lines.mapIndexed { i, x -> if (i == index) x.copy(category = value) else x } }, label = { Text("Category") }, enabled = !saving)
                        OutlinedTextField(row.title, { value -> lines = lines.mapIndexed { i, x -> if (i == index) x.copy(title = value) else x } }, label = { Text("Title") }, enabled = !saving)
                        OutlinedTextField(row.description, { value -> lines = lines.mapIndexed { i, x -> if (i == index) x.copy(description = value) else x } }, label = { Text("Description") }, enabled = !saving)
                        OutlinedTextField(row.amount, { value -> lines = lines.mapIndexed { i, x -> if (i == index) x.copy(amount = value) else x } }, label = { Text("Amount") }, enabled = !saving)
                        TextButton(onClick = { lines = lines.filterIndexed { i, _ -> i != index } }, enabled = !saving) { Text("Remove line") }
                        HorizontalDivider()
                    }
                }
                item { TextButton(onClick = { lines = lines + ProjectBudgetLineDraft() }, enabled = !saving && lines.size < 250) { Text("Add budget line") } }
            }
        },
        confirmButton = {
            Button(enabled = !saving && validProjectBudget(lines), onClick = { save(project.str("id"), lines) }) {
                Text(if (saving) "Saving…" else "Save budget")
            }
        },
        dismissButton = { TextButton(close, enabled = !saving) { Text("Cancel") } },
    )
}

@Composable
private fun ChangeOrderDialog(row: ProjectChangeDraft, saving: Boolean, error: String?, close: () -> Unit,
    update: ((ProjectChangeDraft) -> ProjectChangeDraft) -> Unit, save: () -> Unit) {
    AlertDialog(onDismissRequest={if(!saving)close()}, title={Text(if(row.id==null)"Add extra work" else "Edit change order")},
        text={LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)){
            error?.let { message -> item { Text(message,color=MaterialTheme.colorScheme.error) } }
            item{OutlinedTextField(row.title,{value->update{it.copy(title=value)}},label={Text("Title")},enabled=!saving)}
            item{OutlinedTextField(row.description,{value->update{it.copy(description=value)}},label={Text("Description")},enabled=!saving)}
            item{OutlinedTextField(row.valueDelta,{value->update{it.copy(valueDelta=value)}},label={Text("Contract value change")},enabled=!saving)}
            item{OutlinedTextField(row.estimatedCostDelta,{value->update{it.copy(estimatedCostDelta=value)}},label={Text("Estimated cost change")},enabled=!saving)}
        }}, confirmButton={Button(save,enabled=!saving&&validProjectChange(row)){Text(if(saving)"Saving…" else "Save draft")}},
        dismissButton={TextButton(close,enabled=!saving){Text("Cancel")}})
}
