package com.salespunch360.mobile.ui.account

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountViewModel
import com.salespunch360.mobile.data.Bootstrap
import com.salespunch360.mobile.ui.account.sales.AccountSalesScreen
import com.salespunch360.mobile.ui.account.sales.CustomerReceiptScreen
import com.salespunch360.mobile.ui.account.sales.QuotationScreen
import com.salespunch360.mobile.ui.account.purchase.PurchaseScreen
import com.salespunch360.mobile.ui.account.purchase.VendorPaymentScreen
import com.salespunch360.mobile.ui.account.expense.ExpenseScreen
import com.salespunch360.mobile.ui.account.inventory.InventoryScreen
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun NativeAccountAuthenticatedApp(data:Bootstrap,onSwitchToSales:(()->Unit)?,onLogout:()->Unit,vm:AccountViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value;val drawer=rememberDrawerState(DrawerValue.Closed);val scope=rememberCoroutineScope();val context=LocalContext.current
 if(state.loading){com.salespunch360.mobile.ui.LoadingScreen("Loading Account…");return}
 ModalNavigationDrawer(drawerState=drawer,drawerContent={ModalDrawerSheet{Row(Modifier.padding(20.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){Icon(Icons.Default.Business,null);Column{Text(state.bootstrap?.company?.name?:data.company.name,fontWeight=FontWeight.Bold);Text(state.bootstrap?.user?.accountRole?.name?.replace('_',' ')?:"Account",style=MaterialTheme.typography.labelMedium)}};HorizontalDivider();LazyColumn(Modifier.weight(1f)){item{NavigationDrawerItem(label={Text("Dashboard")},selected=state.selectedPath.endsWith("dashboard"),onClick={vm.select("/workspace/account/dashboard");scope.launch{drawer.close()}},modifier=Modifier.padding(horizontal=12.dp))};state.bootstrap?.navigation.orEmpty().forEach{group->item{Text(group.label,style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.primary,modifier=Modifier.padding(20.dp,16.dp,20.dp,6.dp))};items(group.items+group.children.flatMap{it.items}){nav->NavigationDrawerItem(label={Text(nav.label)},selected=state.selectedPath==nav.href,onClick={if(nav.href.startsWith("/contact")||nav.href.startsWith("/resources")){context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.salespunch360.com${nav.href}")))}else vm.select(nav.href);scope.launch{drawer.close()}},modifier=Modifier.padding(horizontal=12.dp))}};item{HorizontalDivider();onSwitchToSales?.let{NavigationDrawerItem(label={Text("Switch to Sales")},icon={Icon(Icons.Default.SwapHoriz,null)},selected=false,onClick=it,modifier=Modifier.padding(12.dp))};NavigationDrawerItem(label={Text("Sign out")},icon={Icon(Icons.AutoMirrored.Filled.ExitToApp,null)},selected=false,onClick=onLogout,modifier=Modifier.padding(12.dp))}}}}){Scaffold(topBar={TopAppBar(title={Text(titleFor(state.selectedPath,state.bootstrap?.navigation.orEmpty()))},navigationIcon={IconButton(onClick={scope.launch{drawer.open()}}){Icon(Icons.Default.Menu,"Open Account menu")}},actions={state.bootstrap?.notifications?.pendingExpenseApprovals?.takeIf{it>0}?.let{Badge{Text(it.toString())}}})},snackbarHost={state.error?.let{Snackbar{Row{Text(it,Modifier.weight(1f));TextButton(onClick={vm.load(true)}){Text("Retry")}}}}}){padding->val sales=salesType(state.selectedPath);val purchase=purchaseType(state.selectedPath);when{state.selectedPath.startsWith("/workspace/account/expenses")->ExpenseScreen(padding);inventoryMode(state.selectedPath)!=null->InventoryScreen(inventoryMode(state.selectedPath)!!,padding);state.selectedPath.startsWith("/workspace/account/quotations")->QuotationScreen(padding);state.selectedPath.startsWith("/workspace/account/transactions/money?type=VENDOR_PAYMENT")->VendorPaymentScreen(padding);purchase!=null->PurchaseScreen(purchase,padding);state.selectedPath.startsWith("/workspace/account/transactions/money?type=CUSTOMER_RECEIPT")->CustomerReceiptScreen(padding);sales!=null->AccountSalesScreen(sales,padding);masterKind(state.selectedPath)!=null->AccountMasterScreen(masterKind(state.selectedPath)!!,padding);state.selectedPath.endsWith("dashboard")||state.selectedPath=="/workspace/account"->AccountDashboardScreen(state.dashboard,state.bootstrap?.branch?.branchName,state.refreshing,{vm.load(true)});else->NativeDestinationNotice(Modifier.padding(padding),titleFor(state.selectedPath,state.bootstrap?.navigation.orEmpty()))}}}
}

@Composable private fun AccountDashboardScreen(data:com.salespunch360.mobile.data.AccountDashboard?,branch:String?,refreshing:Boolean,onRefresh:()->Unit){LazyColumn(Modifier.fillMaxSize().padding(top=72.dp),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column{Text(data?.title?:"Account Dashboard",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Text("${branch?:"Company"} · ${data?.period.orEmpty()}")};TextButton(enabled=!refreshing,onClick=onRefresh){Text(if(refreshing)"Refreshing…" else "Refresh")}}};items(data?.metrics.orEmpty()){metric->ElevatedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(18.dp)){Text(metric.label,style=MaterialTheme.typography.labelLarge);Text(formatMetric(metric.value,metric.kind),style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}}};if(data?.branchComparison?.isNotEmpty()==true){item{Text("Branch comparison",style=MaterialTheme.typography.titleLarge)};items(data.branchComparison){row->ListItem(headlineContent={Text(row.name)},supportingContent={Text("Sales ${formatMetric(row.sales,"MONEY")} · Expenses ${formatMetric(row.expenses,"MONEY")}")},trailingContent={Text(formatMetric(row.operatingContribution,"MONEY"))})}}}}

@Composable private fun NativeDestinationNotice(modifier:Modifier,title:String){Box(modifier.fillMaxSize().padding(24.dp)){Text("$title is part of the native Account workspace. This destination is not routed to the Web product.",style=MaterialTheme.typography.bodyLarge)}}
private fun titleFor(path:String,groups:List<com.salespunch360.mobile.data.AccountNavigationGroup>)=if(path.endsWith("dashboard")||path=="/workspace/account")"Dashboard" else (groups.flatMap{it.items+it.children.flatMap{child->child.items}}.firstOrNull{path.startsWith(it.href.substringBefore('?'))}?.label?:"Account")
private fun masterKind(path:String)=when{path=="/workspace/account/customers"->"customers";path=="/workspace/account/vendors"->"vendors";path=="/workspace/account/inventory/items"->"items";path=="/workspace/account/inventory/warehouses"->"warehouses";else->null}
private fun salesType(path:String)=if(path.startsWith("/workspace/account/transactions/new"))Regex("(?:\\?|&)type=([A-Z_]+)").find(path)?.groupValues?.get(1)?.takeIf{it in setOf("SALES_INVOICE","PROFORMA_INVOICE","SALES_ORDER","DELIVERY_CHALLAN","CREDIT_NOTE")} else null
private fun formatMetric(raw:String,kind:String)=if(kind!="MONEY")raw else runCatching{NumberFormat.getCurrencyInstance(Locale("en","IN")).format(BigDecimal(raw))}.getOrDefault(raw)

private fun purchaseType(path:String)=if(path.startsWith("/workspace/account/transactions/new"))Regex("(?:\\?|&)type=([A-Z_]+)").find(path)?.groupValues?.get(1)?.takeIf{it in setOf("PURCHASE_BILL","PURCHASE_ORDER","DEBIT_NOTE")} else null

private fun inventoryMode(path:String)=when{path=="/workspace/account/inventory"||path.endsWith("/inventory/stock")->"stock";path.endsWith("/inventory/low-stock")->"low-stock";path.endsWith("/inventory/opening")->"opening";path.endsWith("/inventory/transfers")->"transfers";path.endsWith("/inventory/adjustments")->"adjustments";path.endsWith("/inventory/batches")->"batches";path.endsWith("/inventory/serials")->"serials";path.endsWith("/inventory/prices")->"prices";else->null}
