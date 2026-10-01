package com.salespunch360.mobile.ui.account

import android.content.Intent
import android.net.Uri
import java.io.File
import androidx.core.content.FileProvider
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Work
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountViewModel
import com.salespunch360.mobile.data.AccountNavigationGroup
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.ui.BranchesScreen
import com.salespunch360.mobile.ui.ChangePasswordScreen
import com.salespunch360.mobile.ui.CompanyIdentity
import com.salespunch360.mobile.ui.CompanyProfileScreen
import com.salespunch360.mobile.ui.SubscriptionScreen
import com.salespunch360.mobile.ui.account.accounting.AssetScreen
import com.salespunch360.mobile.ui.account.accounting.ChartOfAccountsScreen
import com.salespunch360.mobile.ui.account.accounting.FinancialYearScreen
import com.salespunch360.mobile.ui.account.accounting.JournalScreen
import com.salespunch360.mobile.ui.account.admin.AccountAdministrationScreen
import com.salespunch360.mobile.ui.account.admin.AccountSettingsMenuScreen
import com.salespunch360.mobile.ui.account.admin.AccountUtilityScreen
import com.salespunch360.mobile.ui.account.expense.ExpenseCategoryScreen
import com.salespunch360.mobile.ui.account.expense.ExpenseScreen
import com.salespunch360.mobile.ui.account.inventory.InventoryScreen
import com.salespunch360.mobile.ui.account.money.MoneyScreen
import com.salespunch360.mobile.ui.account.project.ProjectScreen
import com.salespunch360.mobile.ui.account.purchase.PurchaseScreen
import com.salespunch360.mobile.ui.account.purchase.VendorPaymentScreen
import com.salespunch360.mobile.ui.account.reports.AccountReportsScreen
import com.salespunch360.mobile.ui.account.sales.AccountSalesScreen
import com.salespunch360.mobile.ui.account.sales.CustomerReceiptScreen
import com.salespunch360.mobile.ui.account.sales.QuotationScreen
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

private const val ACCOUNT_HOME="/workspace/account"
private const val ACCOUNT_DASHBOARD="/workspace/account/dashboard"
private const val ACCOUNT_MENU="/workspace/account/menu"

private data class AccountBottomDestination(val label:String,val path:String,val icon:ImageVector)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NativeAccountAuthenticatedApp(
    data:Bootstrap,
    onSwitchToSales:(()->Unit)?,
    onLogout:()->Unit,
    vm:AccountViewModel=viewModel()
){
    val state=vm.state.collectAsStateWithLifecycle().value
    val context=LocalContext.current
    var profileMenu by remember{mutableStateOf(false)}
    if(state.loading){com.salespunch360.mobile.ui.LoadingScreen("Loading Account…");return}

    val account=state.bootstrap
    val modules=account?.enabledModules.orEmpty()
    val navigation=account?.navigation.orEmpty()
    // Bootstrap navigation is already filtered by the shared module and permission policy.
    val showProjects=navigation.any{group->
        (group.items+group.children.flatMap{it.items}).any{it.label=="Projects"&&it.href=="/workspace/account/projects"}
    }
    val canStock="ACCOUNT_STOCK" in account?.effectivePermissions.orEmpty()&&"INVENTORY" in modules&&account?.itemSettings?.get("enabled")?.toString()!="false"
    val canSettings="ACCOUNT_SETTINGS" in account?.effectivePermissions.orEmpty()&&data.user.accountRole==com.salespunch360.mobile.data.AccountRole.ACCOUNT_ADMIN
    val bottom=buildList{
        add(AccountBottomDestination("Home",ACCOUNT_HOME,Icons.Default.Home))
        add(AccountBottomDestination("Dashboard",ACCOUNT_DASHBOARD,Icons.Default.Dashboard))
        if(showProjects)add(AccountBottomDestination("Projects","/workspace/account/projects",Icons.Default.Work))
        if(canStock)add(AccountBottomDestination("Items","/workspace/account/inventory",Icons.Default.Inventory2))
    }

    BackHandler(enabled=state.selectedPath!=ACCOUNT_HOME){vm.back()}

    Scaffold(
        containerColor=Color(0xFFF7F8FC),
        topBar={
            TopAppBar(
                colors=TopAppBarDefaults.topAppBarColors(containerColor=Color.White),
                title={CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)},
                navigationIcon={IconButton(onClick={vm.select(ACCOUNT_MENU)}){Icon(Icons.Default.Menu,"Open Account menu")}},
                actions={
                    val notificationCount=account?.notifications?.pendingExpenseApprovals?:0
                    IconButton(onClick={vm.select("/workspace/account/notifications")}){
                        BadgedBox(badge={if(notificationCount>0)Badge{Text(if(notificationCount>99)"99+" else notificationCount.toString())}}){Icon(Icons.Default.Notifications,"Account notifications")}
                    }
                    Box{
                        IconButton(onClick={profileMenu=true}){
                            Surface(shape=CircleShape,color=Color(0xFFEAF3FF)){
                                Box(Modifier.size(42.dp),contentAlignment=Alignment.Center){
                                    Text(data.user.name.trim().firstOrNull()?.uppercase()?:"A",color=Color(0xFF2D6CC0),fontWeight=FontWeight.Bold)
                                }
                            }
                        }
                        DropdownMenu(expanded=profileMenu,onDismissRequest={profileMenu=false}){
                            DropdownMenuItem(text={Text("Company Details")},onClick={profileMenu=false;vm.select("/workspace/company-profile")})
                            DropdownMenuItem(text={Text("Billing & Subscription")},onClick={profileMenu=false;vm.select("/workspace/billing")})
                            DropdownMenuItem(text={Text("Change Password")},onClick={profileMenu=false;vm.select("/workspace/change-password")})
                            if(canSettings)DropdownMenuItem(text={Text("Module Selection")},onClick={profileMenu=false;vm.select("/workspace/account/settings/modules")})
                            DropdownMenuItem(text={Text("Settings")},onClick={profileMenu=false;vm.select("/workspace/account/settings")})
                            onSwitchToSales?.let{switch->DropdownMenuItem(text={Text("Switch to Sales")},onClick={profileMenu=false;switch()})}
                            HorizontalDivider()
                            DropdownMenuItem(text={Text("Sign out")},onClick={profileMenu=false;onLogout()})
                        }
                    }
                }
            )
        },
        bottomBar={AccountBottomBar(bottom,state.selectedPath,vm::select)},
        snackbarHost={state.error?.let{Snackbar{Row{Text(it,Modifier.weight(1f));TextButton(onClick={vm.load(true)}){Text("Retry")}}}}}
    ){padding->
        val sales=salesType(state.selectedPath)
        val purchase=purchaseType(state.selectedPath)
        when{
            state.selectedPath==ACCOUNT_HOME->AccountHomeScreen(navigation,state.home,state.homeQuery,state.homeTypes,padding,vm::select,vm::searchHome,vm::downloadDocumentPdf)
            state.selectedPath==ACCOUNT_DASHBOARD->AccountDashboardScreen(state.dashboard,account?.branch?.branchName,state.refreshing,{vm.load(true)},padding)
            state.selectedPath==ACCOUNT_MENU->AccountMenuScreen(navigation,padding){href->openAccountPath(context,href,vm::select)}
            state.selectedPath=="/workspace/account/expenses/categories"->ExpenseCategoryScreen(padding)
            state.selectedPath.startsWith("/workspace/account/expenses")->ExpenseScreen(padding)
            state.selectedPath=="/workspace/account/projects/material"->com.salespunch360.mobile.ui.account.project.ProjectMaterialScreen(padding)
            state.selectedPath.startsWith("/workspace/account/projects")->ProjectScreen(padding)
            moneyMode(state.selectedPath)!=null->MoneyScreen(moneyMode(state.selectedPath)!!,padding)
            state.selectedPath.startsWith("/workspace/account/accounting/accounts")->ChartOfAccountsScreen(padding)
            state.selectedPath.startsWith("/workspace/account/accounting/cost-centres")->ChartOfAccountsScreen(padding,true)
            state.selectedPath.startsWith("/workspace/account/accounting/new")->JournalScreen(padding=padding)
            state.selectedPath.startsWith("/workspace/account/accounting/journals")->JournalScreen(padding=padding)
            state.selectedPath.startsWith("/workspace/account/accounting/opening")->JournalScreen(padding=padding,opening=true)
            state.selectedPath.startsWith("/workspace/account/assets")->AssetScreen(padding)
            state.selectedPath.startsWith("/workspace/account/utilities/financial-year")->FinancialYearScreen(false,padding)
            state.selectedPath.startsWith("/workspace/account/utilities/period-locks")->FinancialYearScreen(true,padding)
            state.selectedPath.startsWith("/workspace/account/reports")->AccountReportsScreen(reportName(state.selectedPath),padding)
            utilityMode(state.selectedPath)!=null->AccountUtilityScreen(utilityMode(state.selectedPath)!!,padding)
            adminMode(state.selectedPath)!=null->AccountAdministrationScreen(adminMode(state.selectedPath)!!,padding)
            state.selectedPath=="/workspace/company-profile"->Box(Modifier.padding(padding)){CompanyProfileScreen()}
            state.selectedPath=="/workspace/employees"->AccountAdministrationScreen("users",padding)
            state.selectedPath=="/workspace/account/settings"->AccountSettingsMenuScreen(padding,vm::select,vm::back)
            state.selectedPath=="/workspace/branches"->Box(Modifier.padding(padding)){BranchesScreen()}
            state.selectedPath=="/workspace/billing"->Box(Modifier.padding(padding)){SubscriptionScreen()}
            state.selectedPath=="/workspace/change-password"->Box(Modifier.padding(padding)){ChangePasswordScreen()}
            state.selectedPath=="/workspace/account/inventory"->com.salespunch360.mobile.ui.account.inventory.AccountItemsScreen(padding,canSettings,vm::select)
            state.selectedPath=="/workspace/account/inventory/online-store"->com.salespunch360.mobile.ui.account.inventory.OnlineStoreScreen(padding){vm.back()}
            state.selectedPath=="/workspace/account/inventory/item-settings"&&canSettings->AccountAdministrationScreen("item-settings",padding)
            inventoryMode(state.selectedPath)!=null->InventoryScreen(inventoryMode(state.selectedPath)!!,padding)
            state.selectedPath.startsWith("/workspace/account/quotations")->QuotationScreen(padding)
            state.selectedPath.startsWith("/workspace/account/transactions/money?type=VENDOR_PAYMENT")->VendorPaymentScreen(padding)
            purchase!=null->PurchaseScreen(purchase,padding)
            state.selectedPath.startsWith("/workspace/account/transactions/money?type=CUSTOMER_RECEIPT")->CustomerReceiptScreen(padding)
            sales!=null->AccountSalesScreen(sales,padding)
            masterKind(state.selectedPath)!=null->AccountMasterScreen(masterKind(state.selectedPath)!!,padding)
            else->NativeDestinationNotice(Modifier.padding(padding),titleFor(state.selectedPath,navigation))
        }
    }
}

@Composable
private fun AccountBottomBar(items:List<AccountBottomDestination>,current:String,navigate:(String)->Unit){
    NavigationBar(containerColor=Color.White,tonalElevation=4.dp){
        items.forEach{item->
            val selected=when(item.path){
                ACCOUNT_HOME->current==ACCOUNT_HOME
                ACCOUNT_DASHBOARD->current==ACCOUNT_DASHBOARD
                "/workspace/account/inventory"->current.startsWith("/workspace/account/inventory")
                "/workspace/account/projects"->current.startsWith("/workspace/account/projects")
                ACCOUNT_MENU->current==ACCOUNT_MENU
                else->current==item.path
            }
            NavigationBarItem(
                selected=selected,
                onClick={navigate(item.path)},
                icon={Icon(item.icon,item.label)},
                label={Text(item.label,maxLines=1)}
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccountHomeScreen(
    groups:List<AccountNavigationGroup>,
    home:com.salespunch360.mobile.data.AccountHome?,
    homeQuery:String,
    homeTypes:Set<String>,
    padding:PaddingValues,
    navigate:(String)->Unit,
    search:(String,Set<String>)->Unit,
    pdf:(String,String,(ByteArray)->Unit)->Unit
){
    val context=LocalContext.current
    val all=groups.flatMap{it.items+it.children.flatMap{child->child.items}}
    var partyMode by rememberSaveable{mutableStateOf(false)}
    var query by rememberSaveable(homeQuery){mutableStateOf(homeQuery)}
    var filterOpen by rememberSaveable{mutableStateOf(false)}
    var addLauncherOpen by rememberSaveable{mutableStateOf(false)}
    var moreContext by rememberSaveable{mutableStateOf<String?>(null)}
    var draftTypes by remember(homeTypes,filterOpen){mutableStateOf(homeTypes)}
    val listState=rememberLazyListState()
    val floatingVisible by remember{derivedStateOf{!listState.isScrollInProgress}}
    val filters=listOf(
        "SALES_INVOICE" to "Sale","SALES_ORDER" to "Sale Order","CREDIT_NOTE" to "Credit Note","PURCHASE_BILL" to "Purchase",
        "PURCHASE_ORDER" to "Purchase Order","DEBIT_NOTE" to "Debit Note","CUSTOMER_RECEIPT" to "Payment-In","VENDOR_PAYMENT" to "Payment-Out",
        "ESTIMATE" to "Estimate","PROFORMA_INVOICE" to "Proforma Invoice","EXPENSE" to "Expense","DELIVERY_CHALLAN" to "Delivery Challan",
        "P2P_RECEIVED" to "Party To Party [Rcvd]","P2P_PAID" to "Party To Party [Paid]","SALE_FA" to "Sale FA","PURCHASE_FA" to "Purchase FA",
        "SALE_CANCELLED" to "Sale [Cancelled]","JOB_WORK_OUT" to "Job work out (Challan)","SUBCONTRACT_PURCHASE" to "Purchase (Job work)","SALE_REPEATING" to "Sale [Repeating]"
    )
    val transactionMore=listOf("Bank Accounts" to "/workspace/account/money/accounts","Day Book" to "/workspace/account/reports/general-ledger","All Txns Report" to "/workspace/account/transactions","Profit & Loss" to "/workspace/account/reports/profit-loss","Balance Sheet" to "/workspace/account/reports/balance-sheet","Billwise PnL" to "/workspace/account/reports/invoices","Print Settings" to "/workspace/account/settings/print-templates","Txn SMS Settings" to "")
    val partyMore=listOf("All Parties Report" to "/workspace/account/reports/customers","Import Party" to "/workspace/account/utilities/import","Partywise P&L" to "/workspace/account/reports/customers")
    val transactionActions=listOf("Add Txn" to (all.firstOrNull{it.href.contains("transactions/new")||it.label.contains("invoice",true)}?.href?:"/workspace/account/transactions/new?type=SALES_INVOICE"),"Sale Report" to "/workspace/account/reports/invoices","Txn Settings" to "/workspace/account/settings/transactions","Show All" to "")
    val partyActions=listOf("Network" to "","Party Statement" to "/workspace/account/reports/customer-ledger","Party Settings" to "/workspace/account/settings/custom-fields","Show All" to "")
    val actions=if(partyMode)partyActions else transactionActions

    Box(Modifier.fillMaxSize().padding(padding)){
        LazyColumn(state=listState,modifier=Modifier.fillMaxSize(),contentPadding=PaddingValues(start=16.dp,top=16.dp,end=16.dp,bottom=92.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
            item{AccountSegmentedTabs(partyMode){next->partyMode=next;query="";search("",emptySet())}}
            item{
                ElevatedCard(Modifier.fillMaxWidth(),colors=CardDefaults.elevatedCardColors(containerColor=Color.White)){
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                        Text("Quick Links",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.SemiBold)
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)){
                            actions.forEach{action->
                                val enabled=action.second.isNotBlank()||action.first=="Show All"
                                Column(Modifier.weight(1f).clickable(enabled=enabled){if(action.first=="Add Txn")addLauncherOpen=true else if(action.first=="Show All")moreContext=if(partyMode)"party" else "transaction" else navigate(action.second)}.padding(vertical=8.dp),horizontalAlignment=Alignment.CenterHorizontally){
                                    Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFEFF6FF)){Icon(when(action.first){"Add Txn"->Icons.Default.Add;"Sale Report"->Icons.Default.Assessment;"Txn Settings"->Icons.Default.Settings;else->Icons.Default.Apps},action.first,Modifier.padding(10.dp),tint=Color(0xFF2563EB))}
                                    Spacer(Modifier.height(6.dp));Text(action.first,style=MaterialTheme.typography.labelMedium,maxLines=2)
                                    if(!enabled)Text("Later",style=MaterialTheme.typography.labelSmall,color=Color(0xFF64748B))
                                }
                            }
                        }
                    }
                }
            }
            item{
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp),verticalAlignment=Alignment.CenterVertically){
                    OutlinedTextField(query,{query=it},placeholder={Text(if(partyMode)"Search parties" else "Search party or document")},singleLine=true,modifier=Modifier.weight(1f),leadingIcon={Icon(Icons.Default.Search,null)},trailingIcon={IconButton(onClick={search(query,homeTypes)}){Icon(Icons.Default.Search,"Search")}})
                    if(!partyMode)OutlinedIconButton(onClick={draftTypes=homeTypes;filterOpen=true}){Icon(Icons.Default.FilterList,"Filter transactions")}
                }
            }
            if(!partyMode){
                items(home?.transactions.orEmpty(),key={it.id}){tx->
                    ElevatedCard(Modifier.fillMaxWidth()){
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(tx.partyName,fontWeight=FontWeight.SemiBold);AssistChip(onClick={},label={Text(tx.status.replace('_',' '))})}
                            Text("${tx.type.replace('_',' ')} · ${tx.documentNumber}",color=Color(0xFF64748B));Text(tx.issueDate.take(10),style=MaterialTheme.typography.bodySmall)
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Total ${formatMetric(tx.grandTotal,"MONEY")}");Text("Balance ${formatMetric(tx.balanceDue,"MONEY")}")}
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){TextButton(onClick={pdf(tx.type,tx.id){bytes->sharePdf(context,tx.documentNumber,bytes,"View / print PDF")}}){Text("Print")};TextButton(onClick={pdf(tx.type,tx.id){bytes->sharePdf(context,tx.documentNumber,bytes,"Share transaction")}}){Text("Share")};TextButton(onClick={navigate("/workspace/account/transactions/${tx.id}")}){Text("More")}}
                        }
                    }
                }
            }else{
                items(home?.parties.orEmpty(),key={it.id}){party->ElevatedCard(Modifier.fillMaxWidth().clickable{navigate("/workspace/account/customers?q=${Uri.encode(party.name)}")}){Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween){Column{Text(party.name,fontWeight=FontWeight.SemiBold);Text("Last activity ${party.lastActivity.take(10)}",style=MaterialTheme.typography.bodySmall,color=Color(0xFF64748B))};Text(formatMetric(party.balance,"MONEY"),fontWeight=FontWeight.Bold)}}}
            }
        }
        AnimatedVisibility(visible=floatingVisible,modifier=Modifier.align(Alignment.BottomEnd).padding(16.dp),enter=fadeIn()+slideInVertically{it/2},exit=fadeOut()+slideOutVertically{it/2}){
            ExtendedFloatingActionButton(onClick={navigate(if(partyMode)"/workspace/account/customers" else "/workspace/account/transactions/new?type=SALES_INVOICE")},icon={Icon(Icons.Default.Add,null)},text={Text(if(partyMode)"New Party" else "New Sale")})
        }
    }
    if(filterOpen)ModalBottomSheet(onDismissRequest={filterOpen=false},dragHandle=null){
        Column(Modifier.fillMaxWidth().heightIn(max=640.dp)){
            Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("Filter By",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);IconButton(onClick={filterOpen=false}){Icon(Icons.Default.Close,"Close")}}
            LazyColumn(Modifier.weight(1f)){items(filters){filter->Row(Modifier.fillMaxWidth().clickable{draftTypes=if(filter.first in draftTypes)draftTypes-filter.first else draftTypes+filter.first}.padding(horizontal=16.dp,vertical=6.dp),verticalAlignment=Alignment.CenterVertically){Checkbox(filter.first in draftTypes,{checked->draftTypes=if(checked)draftTypes+filter.first else draftTypes-filter.first});Text(filter.second)}}}
            Surface(shadowElevation=8.dp){Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick={draftTypes=emptySet()},Modifier.weight(1f)){Text("Clear")};Button(onClick={search(query,draftTypes);filterOpen=false},Modifier.weight(1f)){Text("Apply")}}}
        }
    }
    if(addLauncherOpen) AddTransactionLauncher(onDismiss={addLauncherOpen=false}){path->addLauncherOpen=false;navigate(path)}
    moreContext?.let{kind->ModalBottomSheet(onDismissRequest={moreContext=null},dragHandle=null){Column(Modifier.fillMaxWidth().padding(bottom=24.dp)){Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("More Options",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);IconButton(onClick={moreContext=null}){Icon(Icons.Default.Close,"Close")}};(if(kind=="transaction")transactionMore else partyMore).forEach{option->ListItem(headlineContent={Text(option.first)},leadingContent={Icon(Icons.Default.Apps,null)},modifier=Modifier.clickable(enabled=option.second.isNotBlank()){moreContext=null;navigate(option.second)});HorizontalDivider()}}}}
}

private data class LauncherItem(val label:String,val path:String?=null)
private val launcherGroups=listOf(
    "Sale transactions" to listOf(LauncherItem("Payment-In","/workspace/account/transactions/money?type=CUSTOMER_RECEIPT"),LauncherItem("Sale Return","/workspace/account/transactions/new?type=CREDIT_NOTE"),LauncherItem("Delivery Challan","/workspace/account/transactions/new?type=DELIVERY_CHALLAN"),LauncherItem("Estimate / Quotation","/workspace/account/quotations/new"),LauncherItem("Proforma Invoice","/workspace/account/transactions/new?type=PROFORMA_INVOICE"),LauncherItem("Sale Order","/workspace/account/transactions/new?type=SALES_ORDER"),LauncherItem("Sale Invoice","/workspace/account/transactions/new?type=SALES_INVOICE"),LauncherItem("Mobile POS")),
    "Purchase transactions" to listOf(LauncherItem("Purchase","/workspace/account/transactions/new?type=PURCHASE_BILL"),LauncherItem("Payment-Out","/workspace/account/transactions/money?type=VENDOR_PAYMENT"),LauncherItem("Purchase Return","/workspace/account/transactions/new?type=DEBIT_NOTE"),LauncherItem("Purchase Order","/workspace/account/transactions/new?type=PURCHASE_ORDER")),
    "Other transactions" to listOf(LauncherItem("Expenses","/workspace/account/expenses/new"),LauncherItem("P2P Transfer","/workspace/account/money/transfers"))
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun AddTransactionLauncher(onDismiss:()->Unit,navigate:(String)->Unit){
    ModalBottomSheet(onDismissRequest=onDismiss,dragHandle=null){LazyColumn(Modifier.fillMaxWidth().heightIn(max=720.dp),contentPadding=PaddingValues(bottom=28.dp)){
        item{Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("Add Transaction",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);IconButton(onClick=onDismiss){Icon(Icons.Default.Close,"Close")}}}
        launcherGroups.forEach{group->item{Text(group.first.uppercase(),Modifier.padding(horizontal=16.dp,vertical=10.dp),style=MaterialTheme.typography.labelMedium,color=Color(0xFF64748B),fontWeight=FontWeight.Bold)};items(group.second.chunked(3)){row->Row(Modifier.fillMaxWidth().padding(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){row.forEach{entry->Surface(Modifier.weight(1f).heightIn(min=96.dp).clickable(enabled=entry.path!=null){entry.path?.let(navigate)},shape=RoundedCornerShape(12.dp),border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFFE2E8F0)),color=Color.White){Column(Modifier.fillMaxSize().padding(8.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){Surface(shape=RoundedCornerShape(10.dp),color=Color(0xFFEFF6FF)){Icon(Icons.Default.Add,null,Modifier.padding(9.dp),tint=Color(0xFF2563EB))};Spacer(Modifier.height(5.dp));Text(entry.label,style=MaterialTheme.typography.labelMedium,maxLines=2);if(entry.path==null)Text("Coming Soon",style=MaterialTheme.typography.labelSmall,color=Color(0xFF64748B))}}};repeat(3-row.size){Spacer(Modifier.weight(1f))}}}}
    }}
}
private fun sharePdf(context:android.content.Context,number:String,bytes:ByteArray,title:String){
    val file = File(context.cacheDir, "$number.pdf").also { it.writeBytes(bytes) }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),title))
}

@Composable
private fun AccountSegmentedTabs(partyMode:Boolean,onChange:(Boolean)->Unit){
    Surface(shape=RoundedCornerShape(14.dp),border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFFE2E8F0)),color=Color.White){
        Row(Modifier.fillMaxWidth().padding(4.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)){
            listOf(false to "Transaction Details",true to "Party Details").forEach{(party,label)->
                val selected=partyMode==party
                Surface(Modifier.weight(1f).clickable{onChange(party)},shape=RoundedCornerShape(10.dp),color=if(selected)Color(0xFF2563EB) else Color.Transparent){
                    Box(Modifier.heightIn(min=44.dp),contentAlignment=Alignment.Center){Text(label,color=if(selected)Color.White else Color(0xFF64748B),fontWeight=if(selected)FontWeight.SemiBold else FontWeight.Normal)}
                }
            }
        }
    }
}

@Composable
private fun AccountMenuScreen(groups:List<AccountNavigationGroup>,padding:PaddingValues,open:(String)->Unit){
    var reportsOpen by rememberSaveable{mutableStateOf(false)}
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding=PaddingValues(16.dp),
        verticalArrangement=Arrangement.spacedBy(8.dp)
    ){
        item(key="account-menu-header"){
            Text("Menu",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
            Text("All Account modules available to your role.",style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
        groups.forEachIndexed{groupIndex,group->
            val rows=group.items+group.children.flatMap{it.items}
            val reports=group.label.equals("Reports",ignoreCase=true)
            if(reports){
                item(key="account-group-$groupIndex-${group.label}"){
                    OutlinedButton(onClick={reportsOpen=!reportsOpen},modifier=Modifier.fillMaxWidth().padding(top=6.dp)){
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                            Text(group.label,fontWeight=FontWeight.Bold)
                            Text(if(reportsOpen)"⌃" else "⌄")
                        }
                    }
                }
                if(reportsOpen){
                    items(rows.size,key={rowIndex->"account-row-$groupIndex-$rowIndex-${rows[rowIndex].label}-${rows[rowIndex].href}"}){rowIndex->
                        val nav=rows[rowIndex]
                        OutlinedButton(onClick={open(nav.href)},modifier=Modifier.fillMaxWidth()){
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(nav.label);Text("›")}
                        }
                    }
                }
            }else{
                item(key="account-group-$groupIndex-${group.label}"){
                    Text(group.label,style=MaterialTheme.typography.titleSmall,fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.primary,modifier=Modifier.padding(top=10.dp,bottom=2.dp))
                }
                items(rows.size,key={rowIndex->"account-row-$groupIndex-$rowIndex-${rows[rowIndex].label}-${rows[rowIndex].href}"}){rowIndex->
                    val nav=rows[rowIndex]
                    OutlinedButton(onClick={open(nav.href)},modifier=Modifier.fillMaxWidth()){
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(nav.label);Text("›")}
                    }
                }
            }
        }
    }
}

private fun openAccountPath(context:android.content.Context,href:String,navigate:(String)->Unit){
    if(href.startsWith("/contact")||href.startsWith("/resources")){
        context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.salespunch360.com$href")))
    }else navigate(href)
}

@Composable
private fun AccountDashboardScreen(
    data:com.salespunch360.mobile.data.AccountDashboard?,
    branch:String?,
    refreshing:Boolean,
    onRefresh:()->Unit,
    padding:PaddingValues
){
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding=PaddingValues(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)
    ){
        item{
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
                Column{
                    Text(data?.title?:"Account Dashboard",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                    Text("${branch?:"Company"} · ${data?.period.orEmpty()}")
                }
                TextButton(enabled=!refreshing,onClick=onRefresh){Text(if(refreshing)"Refreshing…" else "Refresh")}
            }
        }
        if(data?.projectOnly!=true){
            item{DashboardMetricCard("SALE OVERVIEW · CURRENT MONTH",formatMetric(data?.currentMonthSales?:"0","MONEY"),data?.salesGrowthPercent?.let{"$it% from previous month"}?:"Comparison available after the first recorded month")}
            item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){Box(Modifier.weight(1f)){DashboardMetricCard("EXPENSES",formatMetric(data?.currentMonthExpenses?:"0","MONEY"),"Posted this month")};Box(Modifier.weight(1f)){DashboardMetricCard("CASH & BANK",formatMetric(data?.metrics?.firstOrNull{it.key=="cashBank"}?.value?:"0","MONEY"),"Ledger-backed")}}}
            item{DashboardMetricCard("INVENTORY",formatMetric(data?.metrics?.firstOrNull{it.key=="stockValue"}?.value?:"0","MONEY"),"${data?.itemCount?:0} items · ${data?.lowStockItems?:0} low stock")}
            item{DashboardMetricCard("REPORTS","Business reports","Financial, sales, tax and inventory reports")}
            item{Text("EXPENSE BREAKDOWN · CURRENT MONTH",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
            items(data?.expenseBreakdown.orEmpty()){row->ListItem(headlineContent={Text(row.category)},trailingContent={Text(formatMetric(row.amount,"MONEY"),fontWeight=FontWeight.SemiBold)})}
        }else items(data?.metrics.orEmpty()){metric->DashboardMetricCard(metric.label,formatMetric(metric.value,metric.kind),"")}
        if(data?.branchComparison?.isNotEmpty()==true){
            item{Text("Branch comparison",style=MaterialTheme.typography.titleLarge)}
            items(data.branchComparison){row->
                ListItem(
                    headlineContent={Text(row.name)},
                    supportingContent={Text("Sales ${formatMetric(row.sales,"MONEY")} · Expenses ${formatMetric(row.expenses,"MONEY")}")},
                    trailingContent={Text(formatMetric(row.operatingContribution,"MONEY"))}
                )
            }
        }
    }
}

@Composable private fun DashboardMetricCard(label:String,value:String,detail:String){ElevatedCard(Modifier.fillMaxWidth(),colors=CardDefaults.elevatedCardColors(containerColor=Color.White)){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){Text(label,style=MaterialTheme.typography.labelMedium,color=Color(0xFF64748B),fontWeight=FontWeight.Bold);Text(value,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold);if(detail.isNotBlank())Text(detail,style=MaterialTheme.typography.bodySmall,color=Color(0xFF64748B))}}}

@Composable
private fun NativeDestinationNotice(modifier:Modifier,title:String){
    Box(modifier.fillMaxSize().padding(24.dp)){Text("$title is part of the native Account workspace. This destination is not routed to the Web product.",style=MaterialTheme.typography.bodyLarge)}
}

private fun titleFor(path:String,groups:List<AccountNavigationGroup>)=
    if(path==ACCOUNT_HOME)"Home" else if(path==ACCOUNT_DASHBOARD)"Dashboard" else groups.flatMap{it.items+it.children.flatMap{child->child.items}}.firstOrNull{path.startsWith(it.href.substringBefore('?'))}?.label?:"Account"

private fun masterKind(path:String)=when{
    path=="/workspace/account/customers"->"customers"
    path=="/workspace/account/vendors"->"vendors"
    path=="/workspace/account/inventory/items"->"items"
    path=="/workspace/account/inventory/warehouses"->"warehouses"
    else->null
}

private fun salesType(path:String)=if(path.startsWith("/workspace/account/transactions/new"))Regex("(?:\\?|&)type=([A-Z_]+)").find(path)?.groupValues?.get(1)?.takeIf{it in setOf("SALES_INVOICE","PROFORMA_INVOICE","SALES_ORDER","DELIVERY_CHALLAN","CREDIT_NOTE")} else null
private fun formatMetric(raw:String,kind:String)=if(kind!="MONEY")raw else runCatching{NumberFormat.getCurrencyInstance(Locale("en","IN")).format(BigDecimal(raw))}.getOrDefault(raw)
private fun purchaseType(path:String)=if(path.startsWith("/workspace/account/transactions/new"))Regex("(?:\\?|&)type=([A-Z_]+)").find(path)?.groupValues?.get(1)?.takeIf{it in setOf("PURCHASE_BILL","PURCHASE_ORDER","DEBIT_NOTE")} else null

private fun inventoryMode(path:String)=when{
    path.endsWith("/inventory/stock")||path.endsWith("/inventory/stock-summary")->"stock"
    path.endsWith("/inventory/low-stock")->"low-stock"
    path.endsWith("/inventory/opening")->"opening"
    path.endsWith("/inventory/transfers")->"transfers"
    path.endsWith("/inventory/adjustments")->"adjustments"
    path.endsWith("/inventory/batches")->"batches"
    path.endsWith("/inventory/serials")->"serials"
    path.endsWith("/inventory/prices")->"prices"
    else->null
}

private fun moneyMode(path:String)=when{
    path.startsWith("/workspace/account/money/accounts")->"accounts"
    path.startsWith("/workspace/account/money/transfers")->"transfers"
    path.startsWith("/workspace/account/money/capital")->"owners"
    path.startsWith("/workspace/account/money/loans")->"loans"
    else->null
}

private fun reportName(path:String)=path.removePrefix("/workspace/account/reports/").takeIf{path!="/workspace/account/reports"&&it.isNotBlank()}

private fun adminMode(path:String)=when{
    path=="/workspace/account/notifications"->"notifications"
    path.endsWith("/settings/general")->"general"
    path.endsWith("/settings/transactions")->"transaction-settings"
    path.endsWith("/settings/custom-fields")->"custom-fields"
    path.endsWith("/settings/modules")->"modules"
    path.endsWith("/settings/print-templates")->"print-templates"
    path=="/workspace/account/tax"||path.endsWith("/tax/reports")->"tax-reports"
    path.endsWith("/tax/settings")->"tax-settings"
    path.endsWith("/utilities/audit")->"audit"
    path.endsWith("/utilities/recycle-bin")->"recycle-bin"
    path.endsWith("/utilities/verification")->"verification"
    path.endsWith("/utilities/import")->"imports"
    else->null
}

private fun utilityMode(path:String)=when{
    path.endsWith("/utilities/import")||path.contains("/utilities/import/")->"import"
    path.endsWith("/utilities/export")->"export"
    path.endsWith("/utilities/backup")->"backup"
    path.endsWith("/utilities/recycle-bin")->"recycle"
    else->null
}
