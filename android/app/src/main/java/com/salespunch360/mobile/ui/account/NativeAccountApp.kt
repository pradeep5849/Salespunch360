package com.salespunch360.mobile.ui.account

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Work
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
import com.salespunch360.mobile.ui.SettingsScreen
import com.salespunch360.mobile.ui.SubscriptionScreen
import com.salespunch360.mobile.ui.account.accounting.AssetScreen
import com.salespunch360.mobile.ui.account.accounting.ChartOfAccountsScreen
import com.salespunch360.mobile.ui.account.accounting.FinancialYearScreen
import com.salespunch360.mobile.ui.account.accounting.JournalScreen
import com.salespunch360.mobile.ui.account.admin.AccountAdministrationScreen
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
    val bottom=buildList{
        add(AccountBottomDestination("Home",ACCOUNT_HOME,Icons.Default.Home))
        add(AccountBottomDestination("Dashboard",ACCOUNT_DASHBOARD,Icons.Default.Dashboard))
        if("INVENTORY" in modules)add(AccountBottomDestination("Items","/workspace/account/inventory",Icons.Default.Inventory2))
        if("PROJECTS" in modules)add(AccountBottomDestination("Projects","/workspace/account/projects",Icons.Default.Work))
        add(AccountBottomDestination("Menu",ACCOUNT_MENU,Icons.Default.Menu))
    }

    BackHandler(enabled=state.selectedPath!=ACCOUNT_HOME){vm.back()}

    Scaffold(
        containerColor=Color(0xFFF7F8FC),
        topBar={
            TopAppBar(
                colors=TopAppBarDefaults.topAppBarColors(containerColor=Color.White),
                title={CompanyIdentity(data.company.name,data.company.address,data.company.logoUrl)},
                actions={
                    account?.notifications?.pendingExpenseApprovals?.let{count->
                        IconButton(onClick={vm.select("/workspace/account/notifications")}){
                            BadgedBox(badge={if(count>0)Badge{Text(if(count>99)"99+" else count.toString())}}){Icon(Icons.Default.Notifications,"Account notifications")}
                        }
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
            state.selectedPath==ACCOUNT_HOME->AccountHomeScreen(navigation,state.dashboard,padding,vm::select)
            state.selectedPath==ACCOUNT_DASHBOARD->AccountDashboardScreen(state.dashboard,account?.branch?.branchName,state.refreshing,{vm.load(true)},padding)
            state.selectedPath==ACCOUNT_MENU->AccountMenuScreen(navigation,padding){href->openAccountPath(context,href,vm::select)}
            state.selectedPath=="/workspace/account/expenses/categories"->ExpenseCategoryScreen(padding)
            state.selectedPath.startsWith("/workspace/account/expenses")->ExpenseScreen(padding)
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
            state.selectedPath=="/workspace/account/settings"->Box(Modifier.padding(padding)){SettingsScreen()}
            state.selectedPath=="/workspace/branches"->Box(Modifier.padding(padding)){BranchesScreen()}
            state.selectedPath=="/workspace/billing"->Box(Modifier.padding(padding)){SubscriptionScreen()}
            state.selectedPath=="/workspace/change-password"->Box(Modifier.padding(padding)){ChangePasswordScreen()}
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

@Composable
private fun AccountHomeScreen(
    groups:List<AccountNavigationGroup>,
    dashboard:com.salespunch360.mobile.data.AccountDashboard?,
    padding:PaddingValues,
    navigate:(String)->Unit
){
    val all=groups.flatMap{it.items+it.children.flatMap{child->child.items}}
    val preferred=listOf("invoice","purchase","expense","payment","project","inventory")
    val actions=preferred.mapNotNull{key->all.firstOrNull{it.label.lowercase().contains(key)}}.distinctBy{it.href}.ifEmpty{all.take(6)}
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding=PaddingValues(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)
    ){
        item{
            Text("Home",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
            Text("Quick actions, recent work and things needing attention.",style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if(actions.isNotEmpty()){
            item{Text("Quick actions",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
            items(actions,key={it.href}){action->
                OutlinedButton(onClick={navigate(action.href)},modifier=Modifier.fillMaxWidth()){
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(action.label);Text("→")}
                }
            }
        }
        dashboard?.metrics?.take(4)?.let{metrics->
            if(metrics.isNotEmpty()){
                item{Text("Overview",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)}
                items(metrics,key={it.key}){metric->
                    ElevatedCard(Modifier.fillMaxWidth()){
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
                            Text(metric.label,style=MaterialTheme.typography.labelLarge)
                            Text(formatMetric(metric.value,metric.kind),style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                        }
                    }
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
        items(data?.metrics.orEmpty()){metric->
            ElevatedCard(Modifier.fillMaxWidth()){
                Column(Modifier.padding(18.dp)){
                    Text(metric.label,style=MaterialTheme.typography.labelLarge)
                    Text(formatMetric(metric.value,metric.kind),style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                }
            }
        }
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
    path=="/workspace/account/inventory"||path.endsWith("/inventory/stock")->"stock"
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
    path=="/workspace/account/settings"->"settings"
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
