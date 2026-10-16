package com.salespunch360.mobile.ui.account.expense

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.ExpenseCategoryViewModel
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.ui.account.accountMoney
import kotlinx.serialization.json.*

@Composable
fun ExpenseOverviewScreen(padding:PaddingValues,initialQuery:String,onNavigate:(String)->Unit,vm:ExpenseCategoryViewModel=viewModel()){
 LaunchedEffect(initialQuery){vm.context(initialQuery)}
 val s=vm.state.collectAsStateWithLifecycle().value
 Column(Modifier.fillMaxSize().padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){
   FilterChip(selected=!s.itemTab,onClick={vm.showItems(false)},label={Text("Categories")})
   FilterChip(selected=s.itemTab,onClick={vm.showItems(true)},label={Text("Items")})
  }
  TextButton({onNavigate("/workspace/account/expenses?view=transactions&$initialQuery")}){Text("Transactions, Other Income and recurring expenses")}
  OutlinedTextField(s.query,vm::search,label={Text(if(s.itemTab)"Search items"else "Search categories")},modifier=Modifier.fillMaxWidth(),singleLine=true)
  Text(s.scopeLabel)
  if(s.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  s.error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton({vm.load()}){Text("Retry")}}
  LazyColumn(Modifier.weight(1f)){
   if(s.itemTab){
    if(!s.loading&&s.error==null&&s.expenseItems.isEmpty())item{Text("No expense items found. Add items while recording an expense.")}
    items(s.expenseItems,key={it.str("id")}){row->ListItem(headlineContent={Text(row.str("name"))},supportingContent={Text(if(row["hasPhoto"]?.jsonPrimitive?.booleanOrNull==true)"Photo attached"else "Saved expense item")})}
    item{Text("${s.itemTotal} saved expense items. Posted monetary totals are shown under Categories.")}
    if(s.itemNextOffset!=null)item{TextButton(vm::loadMoreItems,enabled=!s.loading){Text("Load more items")}}
   }else{
    if(!s.loading&&s.error==null&&s.categories.isEmpty())item{Text("No categories found.")}
    items(s.categories,key={it.str("id")}){row->val amount=s.summary?.array("categories")?.firstOrNull{it.str("categoryId")==row.str("id")};ListItem(headlineContent={Text(row.str("name"))},supportingContent={if(row["isActive"]?.jsonPrimitive?.booleanOrNull==false)Text("Inactive")},trailingContent={Text(accountMoney(amount?.str("expense")?:"0.00"))})}
   }
  }
  if(!s.loading&&s.error==null&&!s.itemTab)s.summary?.let{totals->
   HorizontalDivider()
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Total Expense",fontWeight=FontWeight.Bold);Text(accountMoney(totals.str("expense")),fontWeight=FontWeight.Bold)}
   Text("Posted totals · all history")
   if(totals.str("income").toBigDecimalOrNull()?.signum()?.let{it!=0}==true)Text("Other Income: ${accountMoney(totals.str("income"))}")
  }
  if(s.canManage&&!s.itemTab)TextButton({onNavigate("/workspace/account/expenses/categories?create=true&$initialQuery")}){Text("＋ Add Expense / Income Category")}
  if(s.canCreateExpense)Button({onNavigate("/workspace/account/expenses/new?$initialQuery")},modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text("＋ Add Expenses")}
 }
}
