@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.decodeFromString


@Composable fun SubscriptionScreen(){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var data by remember{mutableStateOf<MobileBillingContext?>(null)};var error by remember{mutableStateOf<String?>(null)};var loading by remember{mutableStateOf(true)};var loadingMore by remember{mutableStateOf(false)};var initialPage by remember{mutableStateOf<String?>(null)}
 fun reload(){loading=true;error=null;scope.launch{runCatching{api.billing()}.onSuccess{data=it}.onFailure{error="Unable to load subscription."};loading=false}}
 LaunchedEffect(Unit){runCatching{api.billing()}.onSuccess{data=it}.onFailure{error="Unable to load subscription."};loading=false}
 when{
  loading->Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator()}
  error!=null->RetryScreen(error!!,::reload)
  else->SubscriptionContent(data!!,::reload,loadingMore,loadMore={if(!loadingMore&&data?.hasMoreOrders==true){loadingMore=true;scope.launch{runCatching{api.billing((data?.orderPage?:1)+1)}.onSuccess{next->data=next.copy(orders=data!!.orders+next.orders)}.onFailure{error="Unable to load more payment history."};loadingMore=false}}},initialPage=initialPage,reviewPending={initialPage="HISTORY";reload()})
 }
}

@Composable private fun SubscriptionContent(data:MobileBillingContext,reload:()->Unit,loadingMore:Boolean,loadMore:()->Unit,initialPage:String?,reviewPending:()->Unit){
 var reviewedRevision by remember{mutableStateOf(0)};var fromCart by remember{mutableStateOf(false)};var checkout by remember{mutableStateOf<BillingQuote?>(null)};var page by remember{mutableStateOf<String?>(initialPage)}
 val cartContext=LocalContext.current;val cartApi=remember{ApiClient(SecureSession(cartContext))};var cartCount by remember{mutableStateOf(0)};LaunchedEffect(page){runCatching{cartApi.billingCart()}.onSuccess{cartCount=if(it["selection"]!=null&&it["selection"]!=JsonNull)1 else 0}}
 if(checkout!=null){CheckoutCard(checkout!!,fromCart=fromCart,cartRevision=reviewedRevision,saveComplete={cartCount=1;checkout=null;page="CART"},onlinePaymentAvailable=data.onlinePaymentAvailable,back={checkout=null;reload()},reviewPending={checkout=null;reviewPending()});return}
 when(page){
  "CART"->{SavedBillingCart({page=null},{q,revision->reviewedRevision=revision;fromCart=true;checkout=q});return}
  "SUBSCRIPTION"->{SubscriptionSummaryPage(data){page=null};return}
  "BILLING"->{BillingActionsPage(data,{page=null}){page=it};return}
  null->Unit
  else->{SubscriptionActionPage(data,page!!,{page="BILLING"},{fromCart=false;checkout=it},loadingMore,loadMore,reload);return}
 }
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=14.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Text("Billing & Subscription",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
  item{Button({page="SUBSCRIPTION"},modifier=Modifier.fillMaxWidth()){Text("Subscription")}}
  item{Button({page="BILLING"},modifier=Modifier.fillMaxWidth()){Text("Billing")}}
  item{Button({page="CART"},modifier=Modifier.fillMaxWidth()){Text("Shopping Cart ($cartCount)")}}
  item{Button({page="HISTORY"},modifier=Modifier.fillMaxWidth()){Text("Payment History")}}
 }
}

@Composable private fun SubscriptionSummaryPage(data:MobileBillingContext,back:()->Unit){
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=14.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{TextButton(back,contentPadding=PaddingValues(0.dp)){Text("← Billing & Subscription")};Text("Subscription",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
  if(data.hasSales)item{CompactSalesSummary(data.sales,data.teamStructure)}
  if(data.hasAccount)item{CompactAccountSummary(data.account)}
 }
}

@Composable private fun BillingActionsPage(data:MobileBillingContext,back:()->Unit,open:(String)->Unit){
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=14.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{TextButton(back,contentPadding=PaddingValues(0.dp)){Text("← Billing & Subscription")};Text("Billing",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
  item{if(!data.hasSales)Text("Sales-team billing is unavailable for this company edition.") else if(data.sales?.status!="ACTIVE")Text("Start or renew Sales before adding seats.")}
  item{if(!data.hasAccount)Text("Account team billing is unavailable for this company edition.") else if(data.isPlus&&(data.sales?.status!="ACTIVE"||data.account?.status!="ACTIVE"))Text("Renew Plus before adding Account capacity.")}
  item{Button({open("ADD_SALES")},enabled=data.hasSales&&data.sales?.status=="ACTIVE",modifier=Modifier.fillMaxWidth()){Text("Add Sales Team")}}
  item{Button({open("ADD_ACCOUNT")},enabled=data.hasAccount&&(!data.isPlus||(data.sales?.status=="ACTIVE"&&data.account?.status=="ACTIVE")),modifier=Modifier.fillMaxWidth()){Text("Add Account Team")}}
  item{Button({open("RENEWAL")},modifier=Modifier.fillMaxWidth()){Text("Renewal")}}
 }
}

@Composable private fun SubscriptionActionPage(data:MobileBillingContext,page:String,back:()->Unit,onQuote:(BillingQuote)->Unit,loadingMore:Boolean,loadMore:()->Unit,orderChanged:()->Unit){
 var quoteError by remember(page){mutableStateOf<String?>(null)}
 val quoteFailed:(Throwable)->Unit={quoteError=billingQuoteFailureMessage((it as? ApiException)?.code)}
 val title=when(page){"ADD_SALES"->"Add Sales Team";"ADD_ACCOUNT"->"Add Account Team";"RENEWAL"->"Renewal";else->"Payment History"}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=14.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{TextButton(back,contentPadding=PaddingValues(0.dp)){Text("← Billing")};Text(title,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)}
  quoteError?.let{item{ContentCard("Quote unavailable",it)}}
  when(page){
   "ADD_SALES"->item{if(!data.hasSales)ContentCard("Unavailable","This company edition does not include Sales-team billing.") else if(data.sales?.status!="ACTIVE")ContentCard("Start Sales first","Add Sales Team is for mid-term additions. Use Renewal to start or renew the Sales subscription.") else AddTeamPurchase(data,onQuote,quoteFailed)}
   "ADD_ACCOUNT"->item{if(!data.hasAccount)ContentCard("Unavailable","This company edition does not include Account team billing.") else if(data.isPlus){if(data.sales?.status=="ACTIVE"&&data.account?.status=="ACTIVE")AccountIncreasePurchase(data,onQuote,quoteFailed) else ContentCard("Start Plus first","Mid-term Account team additions require an active Plus subscription.")}else AccountPurchase(data,onQuote,quoteFailed)}
   "RENEWAL"->item{if(data.hasSales)SalesPurchase(data,onQuote,quoteFailed) else if(data.hasAccount)AccountPurchase(data,onQuote,quoteFailed) else ContentCard("Unavailable","No renewable subscription is available.")}
   else->{if(data.orders.isEmpty())item{ContentCard("Payment History","No orders yet.")}else items(data.orders,key={it.id}){order->BillingHistoryOrder(order,orderChanged,data.onlinePaymentAvailable)};if(data.hasMoreOrders)item{OutlinedButton(loadMore,enabled=!loadingMore,modifier=Modifier.fillMaxWidth()){Text(if(loadingMore)"Loading…" else "Load More (${data.orderPage} / ${data.orderTotalPages})")}}}

  }
 }
}

private fun billingHistoryTime(value:String?):String=if(value==null)"Not recorded" else runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))+" IST"}.getOrDefault(value)
@Composable private fun BillingHistoryOrder(order:MobileBillingOrder,orderChanged:()->Unit,onlinePaymentAvailable:Boolean){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var confirmCancel by remember(order.id){mutableStateOf(false)};var cancelBusy by remember(order.id){mutableStateOf(false)};var cancelError by remember(order.id){mutableStateOf<String?>(null)}
 if(confirmCancel)AlertDialog(onDismissRequest={if(!cancelBusy)confirmCancel=false},title={Text("Cancel this unpaid order?")},text={Column(verticalArrangement=Arrangement.spacedBy(6.dp)){Text("Order ${order.id.take(8).uppercase()} · ${periodLabel(order.billingPeriod)} · ${order.currency} ${order.totalAmount}");Text("Admin ${order.adminSeats} · Manager ${order.managerSeats} · Sales ${order.salesSeats} · Telecaller ${order.telecallerSeats?.toString()?:"Not recorded"} · Account packages ${order.accountPackages}");Text("Cancel this request before reviewing a different selection. An already paid order cannot be canceled here.");cancelError?.let{Text(it,color=MaterialTheme.colorScheme.error)}}},confirmButton={Button({cancelBusy=true;cancelError=null;scope.launch{try{api.cancelPendingBillingOrder(order.id);confirmCancel=false;orderChanged()}catch(e:Exception){cancelError=when((e as? ApiException)?.code){"ORDER_NOT_PENDING"->"This order is no longer pending. Refresh Payment History.";"NOT_FOUND"->"This order is no longer available.";else->"The order could not be canceled. Reload its status and try again."}}finally{cancelBusy=false}}},enabled=!cancelBusy){Text(if(cancelBusy)"Canceling…" else "Cancel unpaid order")}},dismissButton={TextButton({confirmCancel=false},enabled=!cancelBusy){Text("Keep order")}})

 var details by remember(order.id){mutableStateOf(false)}
 OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
  Text("Order ${order.id.take(8).uppercase()}",fontWeight=FontWeight.Bold);StatusChip(order.status)
  Text("${periodLabel(order.billingPeriod)} · ${order.currency} ${order.totalAmount}")
  Text("Created ${billingHistoryTime(order.createdAt)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  if(order.provider=="ACCOUNT_PACKAGE")Text("Account packages: ${maxOf(order.accountPackages,order.adminSeats)}") else Text("Admin ${order.adminSeats} · Manager ${order.managerSeats} · Sales ${order.salesSeats} · Account packages ${order.accountPackages}")
  Text("Telecaller target: ${order.telecallerSeats?.toString()?:"Not recorded"}")
  Text("Provider: ${order.provider.replace('_',' ')}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  if(order.status=="PAID" && order.payments.any{it.providerPaymentId.startsWith("cashfree_sandbox_")&&it.status=="CAPTURED"}) CashfreeReceiptButton(order.id)
  if(order.status=="PENDING" && onlinePaymentAvailable) CashfreePaymentControls(order.id,orderChanged)
  if(order.status=="PENDING")OutlinedButton({cancelError=null;confirmCancel=true},enabled=!cancelBusy){Text("Cancel unpaid order")}
  OutlinedButton({details=!details}){Text(if(details)"Hide payment details" else "Order / payment details")}
  if(details){
   Text("Order reference: ${order.id}");Text("Order paid at: ${billingHistoryTime(order.paidAt)}")
   if(order.payments.isEmpty())Text("No payment transaction recorded for this order.")
   order.payments.forEach{payment->HorizontalDivider();Text("Payment ${payment.id} · ${payment.status}");Text("${payment.currency} ${payment.amount}");Text("Reference: ${payment.manualReference?:payment.providerPaymentId}");Text("Created: ${billingHistoryTime(payment.createdAt)}");Text("Captured: ${billingHistoryTime(payment.capturedAt)}")}
  }
 }}
}

@Composable private fun CompactSalesSummary(s:MobileSalesSubscription?,structure:TeamStructure){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Sales Subscription",fontWeight=FontWeight.Bold);StatusChip(s?.status?:"INACTIVE")};s?.endsAt?.let{Text("Common expiry ${it.take(10)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){SeatPill("Admin",s?.adminUsage?:0,s?.adminLimit?:0);if(structure!=TeamStructure.SALES_ONLY)SeatPill("Manager",s?.managerUsage?:0,s?.managerLimit?:0);SeatPill("Sales",s?.salesUsage?:0,s?.salesLimit?:0);SeatPill("Telecaller",s?.telecallerUsage?:0,s?.telecallerLimit?:0)};Text("Admin, Manager, Sales and Telecaller share one Sales subscription expiry.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}}
@Composable private fun CompactAccountSummary(a:MobileAccountSubscription?){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Account Subscription",fontWeight=FontWeight.Bold);StatusChip(a?.status?:"INACTIVE")};a?.endsAt?.let{Text("${if(a.status=="TRIAL")"Trial ends" else "Latest package expiry"} ${it.take(10)} · ${a.packageCount} package${if(a.packageCount==1)"" else "s"}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};a?.nextPackageExpiry?.let{Text("Next package expiry ${it.take(10)} · ${a.expiringPackageCount} package(s) expire then",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){SeatPill("Account Admin",a?.accountAdminUsage?:0,a?.accountAdminLimit?:0);SeatPill("Accountant",a?.accountantUsage?:0,a?.accountantLimit?:0);SeatPill("Project Manager",a?.projectManagerUsage?:0,a?.projectManagerLimit?:0);SeatPill("Data Entry",a?.dataEntryUsage?:0,a?.dataEntryLimit?:0)}}}}
@Composable private fun SeatPill(label:String,used:Int,limit:Int){Surface(shape=MaterialTheme.shapes.small,color=SalesPale){Text("$label  $used / $limit",Modifier.padding(horizontal=8.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall)}}

@Composable private fun AddTeamPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit,onError:(Throwable)->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();val s=data.sales?:return
 val period=s.billingPeriod?:return ContentCard("Reload subscription","The active billing period is unavailable. Reload Billing before adding seats.")
 var addAdmins by remember{mutableStateOf("0")};var addManagers by remember{mutableStateOf("0")};var addSales by remember{mutableStateOf("0")};var addTelecallers by remember{mutableStateOf("0")};var busy by remember{mutableStateOf(false)}
 val addAdminCount=addAdmins.toIntOrNull()?:0;val addManagerCount=if(data.teamStructure==TeamStructure.SALES_ONLY)0 else addManagers.toIntOrNull()?:0;val addSalesCount=addSales.toIntOrNull()?:0;val addTelecallerCount=addTelecallers.toIntOrNull()?:0
 val adminTarget=s.adminLimit+addAdminCount;val managerTarget=if(data.teamStructure==TeamStructure.SALES_ONLY)0 else s.managerLimit+addManagerCount;val salesTarget=s.salesLimit+addSalesCount;val telecallerTarget=s.telecallerLimit+addTelecallerCount;val accountPackages=if(data.isPlus)(data.account?.packageCount?:1).coerceAtLeast(1)else 0;val hasAddition=addAdminCount+addManagerCount+addSalesCount+addTelecallerCount>0
 ContentCard("Add Sales Team","Add Admin, Manager, Sales or Telecaller seats now without renewing. Only added seats are prorated to the current expiry."){
  Text("Current period: ${periodLabel(period)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);s.endsAt?.let{Text("Common expiry: ${it.take(10)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
  NumberField("Add Additional Admin",addAdmins){addAdmins=it};Text("New Additional Admin total: $adminTarget",style=MaterialTheme.typography.labelMedium)
  if(data.teamStructure!=TeamStructure.SALES_ONLY){NumberField("Add Manager",addManagers){addManagers=it};Text("New Manager total: $managerTarget",style=MaterialTheme.typography.labelMedium)}
  NumberField("Add Sales",addSales){addSales=it};Text("New Sales total: $salesTarget",style=MaterialTheme.typography.labelMedium)
  NumberField("Add Telecaller",addTelecallers){addTelecallers=it};Text("New Telecaller total: $telecallerTarget · ₹600 / 6 months · ₹1,000 / year",style=MaterialTheme.typography.labelMedium)
  if(data.isPlus)Text("Account packages stay unchanged at $accountPackages.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  Text("Retention is not used for Add Sales Team. Renewal and seat reductions are handled separately.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  Button({busy=true;scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(purchaseMode="ADD_TEAM",billingPeriod=period,adminSeats=adminTarget,managerSeats=managerTarget,salesSeats=salesTarget,telecallerSeats=telecallerTarget,accountPackages=accountPackages))}.onSuccess(onQuote).onFailure(onError);busy=false}},enabled=!busy&&hasAddition,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Calculating…" else "Review Prorated Price")}
 }
}

@Composable private fun AccountIncreasePurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit,onError:(Throwable)->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();val s=data.sales?:return;val a=data.account?:return
 if(!data.isPlus||s.status!="ACTIVE"||a.status!="ACTIVE")return
 val period=s.billingPeriod?:return ContentCard("Reload subscription","The active billing period is unavailable. Reload Billing before adding packages.")
 val currentPackages=a.packageCount.coerceAtLeast(1);var addPackages by remember{mutableStateOf("0")};var busy by remember{mutableStateOf(false)};val addCount=(addPackages.toIntOrNull()?:0).coerceIn(0,(100-currentPackages).coerceAtLeast(0));val targetPackages=currentPackages+addCount;val managerTarget=if(data.teamStructure==TeamStructure.SALES_ONLY)0 else s.managerLimit
 ContentCard("Add Account Team","Add Account team capacity now without renewing Plus. Only added Account packages are prorated to the current expiry."){
  Text("Current packages: $currentPackages",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text("Current period: ${periodLabel(period)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted);a.endsAt?.let{Text("Current expiry: ${it.take(10)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}
  NumberField("Add Account Packages",addPackages){addPackages=it};Text("New Account package total: $targetPackages",style=MaterialTheme.typography.labelMedium);Text(packageContents(targetPackages),style=MaterialTheme.typography.bodySmall,color=SalesMuted);Text("Sales-team seat limits stay unchanged.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
  Button({busy=true;scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(purchaseMode="ADD_ACCOUNT",billingPeriod=period,adminSeats=s.adminLimit,managerSeats=managerTarget,salesSeats=s.salesLimit,telecallerSeats=s.telecallerLimit,accountPackages=targetPackages))}.onSuccess(onQuote).onFailure(onError);busy=false}},enabled=!busy&&addCount>0,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Calculating…" else "Review Prorated Price")}
 }
}

@Composable private fun SalesPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit,onError:(Throwable)->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var period by remember{mutableStateOf("SIX_MONTH")};val s=data.sales;var admins by remember(s){mutableStateOf((s?.adminLimit?:s?.adminUsage?:0).toString())};var managers by remember(s,data.teamStructure){mutableStateOf((if(data.teamStructure==TeamStructure.SALES_ONLY)0 else s?.managerLimit?:s?.managerUsage?:0).toString())};var sales by remember(s){mutableStateOf((s?.salesLimit?:s?.salesUsage?:1).toString())};var telecallers by remember(s){mutableStateOf(maxOf(s?.telecallerLimit?:0,s?.telecallerUsage?:0).toString())};var accounts by remember(data.account){mutableIntStateOf((data.account?.packageCount?:1).coerceAtLeast(1))};var busy by remember{mutableStateOf(false)};var retained by remember{mutableStateOf(setOf<String>())}
 val telecallerCount=telecallers.toIntOrNull()?:0;val telecallerValid=telecallerCount>=(s?.telecallerUsage?:0)
 ContentCard(if(s?.status=="ACTIVE")"Renewal" else if(data.isPlus)"Choose Plus Plan" else "Choose Sales Plan",if(data.isPlus)"Renew Account packages and Sales-team seats together." else "Renew Admin, Manager, Sales and Telecaller seats on one common term."){PeriodSelector(period){period=it};if(data.isPlus){PackageSelector(accounts){accounts=it};Text("(${packageContents(accounts)})",style=MaterialTheme.typography.bodySmall,color=SalesMuted);HorizontalDivider();Text("Sales Team",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)};NumberField("Additional Admin Seats",admins){admins=it};if(data.teamStructure!=TeamStructure.SALES_ONLY)NumberField("Manager Seats",managers){managers=it};NumberField("Sales Seats",sales){sales=it};NumberField("Telecaller Seats",telecallers){telecallers=it};Text("Telecaller: ₹600 / 6 months · ₹1,000 / year",style=MaterialTheme.typography.bodySmall,color=SalesMuted);if(!telecallerValid)Text("Deactivate Telecaller employees before reducing seats below active usage.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.error);val reduced=listOf(MobileRole.ADMIN to (admins.toIntOrNull()?:0),MobileRole.MANAGER to (managers.toIntOrNull()?:0),MobileRole.SALES to (sales.toIntOrNull()?:0)).filter{(role,count)->data.salesSeatUsers.count{it.salesRole==role}>count};if(reduced.isNotEmpty()){Text("Renewal retention",fontWeight=FontWeight.Bold);Text("Choose users to retain for a next-term reduction. Leave it empty to use server fallback retention rules.",style=MaterialTheme.typography.bodySmall,color=SalesMuted);reduced.forEach{(role,count)->Text("${role.name.replace('_',' ')}: retain up to $count",style=MaterialTheme.typography.labelMedium);data.salesSeatUsers.filter{it.salesRole==role}.forEach{u->Row(verticalAlignment=Alignment.CenterVertically){Checkbox(u.id in retained,{checked->retained=if(checked)retained+u.id else retained-u.id});Text(u.name)}}}};Button({busy=true;scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(purchaseMode="RENEW",billingPeriod=period,adminSeats=admins.toIntOrNull()?:0,managerSeats=managers.toIntOrNull()?:0,salesSeats=sales.toIntOrNull()?:0,telecallerSeats=telecallerCount,accountPackages=if(data.isPlus)accounts else 0,retainAdminUserIds=retained.filter{id->data.salesSeatUsers.any{it.id==id&&it.salesRole==MobileRole.ADMIN}},retainManagerUserIds=retained.filter{id->data.salesSeatUsers.any{it.id==id&&it.salesRole==MobileRole.MANAGER}},retainSalesUserIds=retained.filter{id->data.salesSeatUsers.any{it.id==id&&it.salesRole==MobileRole.SALES}}))}.onSuccess(onQuote).onFailure(onError);busy=false}},enabled=!busy&&telecallerValid&&(sales.toIntOrNull()?:0)+(managers.toIntOrNull()?:0)>0,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Calculating…" else "Review Checkout")}}
}

@Composable private fun AccountPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit,onError:(Throwable)->Unit){val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var period by remember{mutableStateOf("SIX_MONTH")};var quantity by remember{mutableIntStateOf(1)};var busy by remember{mutableStateOf(false)};val six=data.prices.firstOrNull{it.role=="ACCOUNT_PACKAGE"&&it.period=="SIX_MONTH"}?.amount?:"400.00";val year=data.prices.firstOrNull{it.role=="ACCOUNT_PACKAGE"&&it.period=="YEARLY"}?.amount?:"700.00";ContentCard("Account Packages","6 Months ₹$six · Yearly ₹$year per package."){PeriodSelector(period){period=it};PackageSelector(quantity){quantity=it};Text("(${packageContents(quantity)})",style=MaterialTheme.typography.bodySmall,color=SalesMuted);Button({busy=true;scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(kind="ACCOUNT_PACKAGE",billingPeriod=period,quantity=quantity))}.onSuccess(onQuote).onFailure(onError);busy=false}},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Calculating…" else "Review Checkout")}}}
@Composable private fun PeriodSelector(period:String,change:(String)->Unit){Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("SIX_MONTH" to "6 Month","YEARLY" to "Yearly").forEach{(value,label)->FilterChip(selected=period==value,onClick={change(value)},label={Text(label)})}}}
@Composable private fun PackageSelector(value:Int,change:(Int)->Unit){var expanded by remember{mutableStateOf(false)};Column(verticalArrangement=Arrangement.spacedBy(4.dp)){Text("Account Packages",fontWeight=FontWeight.SemiBold);Box{OutlinedButton({expanded=true},Modifier.fillMaxWidth()){Text(value.toString(),Modifier.fillMaxWidth())};DropdownMenu(expanded,{expanded=false}){(1..100).forEach{count->DropdownMenuItem(text={Text(count.toString())},onClick={change(count);expanded=false})}}}}}
@Composable private fun NumberField(label:String,value:String,change:(String)->Unit){OutlinedTextField(value,{change(it.filter(Char::isDigit).take(5))},label={Text(label)},singleLine=true,modifier=Modifier.fillMaxWidth())}
private fun packageContents(count:Int)="$count package${if(count==1)"" else "s"} = $count Account Admin, $count Accountant, $count Project Manager, $count Data Entry"
private fun periodLabel(value:String)=when(value){"SIX_MONTH"->"6 Month";"YEARLY"->"Yearly";else->value.replace('_',' ')}

@Composable private fun CheckoutCard(q:BillingQuote,fromCart:Boolean,cartRevision:Int,saveComplete:()->Unit,onlinePaymentAvailable:Boolean,back:()->Unit,reviewPending:()->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var pending by remember{mutableStateOf<OnlineOrderResponse?>(null)};var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)};var pendingConflict by remember{mutableStateOf(false)}
 if(fromCart){LaunchedEffect(q,cartRevision){if(onlinePaymentAvailable){busy=true;error=null;scope.launch{try{val key="android_"+java.util.UUID.randomUUID().toString().replace("-","");val order=api.createOnlineOrder(com.salespunch360.mobile.data.onlineOrderFromQuote(q,key),cartRevision);pending=order;val session=api.cashfreeCheckout(order.id,"start")["paymentSessionId"]?.jsonPrimitive?.contentOrNull ?: error("Missing session");val url=android.net.Uri.parse("https://www.salespunch360.com/payment/sandbox").buildUpon().encodedFragment("session="+android.net.Uri.encode(session)).build();context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,url))}catch(e:Exception){pendingConflict=(e as? ApiException)?.code=="PENDING_ORDER_CONFLICT";error=(e as? ApiException)?.serverMessage?:"Unable to open online payment. Retry or review Payment History."}finally{busy=false}}}else error="Online payment is unavailable."}}
 pending?.let{order->AndroidPaymentResult(order,busy,error,back);return}

 if(fromCart){Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){if(busy)CircularProgressIndicator();Text(if(busy)"Opening secure payment…" else error?:"Preparing payment…");if(pendingConflict)OutlinedButton(reviewPending){Text("Review unpaid orders")};TextButton(back){Text("Back to billing")}};return}
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{TextButton(back){Text("← Back")};Text(if(fromCart)"Checkout" else "Review subscription",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard("Review","${q.kind.replace('_',' ')} · ${periodLabel(q.billingPeriod)}"){q.salesSubtotal?.let{if(it!="0.00")Text("Sales subtotal ₹$it")};q.telecallerSubtotal?.let{if(it!="0.00")Text("Telecaller subtotal ₹$it")};q.accountSubtotal?.let{if(it!="0.00")Text("Account subtotal ₹$it")};if(q.prorated){Text("Only mid-term additions are charged for the remaining time.",style=MaterialTheme.typography.bodySmall,color=SalesMuted);q.coTermEndsAt?.let{Text("Existing expiry stays ${it.take(10)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}};Text("Total payable",style=MaterialTheme.typography.bodySmall);Text("₹${q.totalAmount}",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)}}
  item{error?.let{Text(it,color=MaterialTheme.colorScheme.error)};if(pendingConflict)OutlinedButton(reviewPending){Text("Review unpaid orders")}} 
  if(!fromCart)item{Button({busy=true;error=null;scope.launch{try{val cart=api.billingCart();val selection=buildJsonObject{put("kind",q.kind);put("billingPeriod",q.billingPeriod);q.purchaseMode?.let{put("purchaseMode",it)};put("adminSeats",q.adminSeats);put("managerSeats",q.managerSeats);put("salesSeats",q.salesSeats);put("telecallerSeats",q.telecallerSeats);put("accountPackages",q.accountPackages);q.quantity?.let{put("quantity",it)};put("retainAdminUserIds",JsonArray(q.retainAdminUserIds.map{JsonPrimitive(it)}));put("retainManagerUserIds",JsonArray(q.retainManagerUserIds.map{JsonPrimitive(it)}));put("retainSalesUserIds",JsonArray(q.retainSalesUserIds.map{JsonPrimitive(it)}))};api.updateBillingCart(cart["revision"]!!.jsonPrimitive.int,selection);saveComplete()}catch(e:Exception){error="Unable to save cart. Please retry."}finally{busy=false}}},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Adding…" else "Add to Cart")};Text("Go to your cart to complete your order.",style=MaterialTheme.typography.bodySmall,color=SalesMuted);TextButton(back,Modifier.fillMaxWidth()){Text(when(q.purchaseMode){"ADD_TEAM"->"← Change added seats";"ADD_ACCOUNT"->"← Change added Account packages";else->if(q.kind=="ACCOUNT_PACKAGE")"← Change package" else "← Change renewal"})}}

 }
}

@Composable private fun CashfreePaymentControls(orderId:String,orderChanged:()->Unit){
 val context=LocalContext.current
 val api=remember{ApiClient(SecureSession(context))}
 val scope=rememberCoroutineScope()
 var busy by remember(orderId){mutableStateOf(false)}
 var recovery by remember(orderId){mutableStateOf(false)}
 var message by remember(orderId){mutableStateOf<String?>(null)}
 Text("Sandbox test payment — no real money is charged.")
 Button({busy=true;message=null;scope.launch{
  try{
   val session=api.cashfreeCheckout(orderId,"start")["paymentSessionId"]?.jsonPrimitive?.contentOrNull ?: error("Missing session")
   val url=android.net.Uri.parse("https://www.salespunch360.com/payment/sandbox").buildUpon().encodedFragment("session="+android.net.Uri.encode(session)).build()
   context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,url))
  }catch(e:Exception){message="Unable to open test checkout."}finally{busy=false}
 }},enabled=!busy){Text("Pay Now – Cashfree")}
 TextButton({recovery=!recovery},enabled=!busy){Text("Already completed payment?")}
 if(recovery)OutlinedButton({busy=true;scope.launch{
  try{val verified=api.cashfreeCheckout(orderId,"verify")["verified"]?.jsonPrimitive?.content=="true";message=if(verified)"Sandbox payment verified." else "Payment not confirmed yet.";if(verified)orderChanged()}
  catch(e:Exception){message="Unable to check payment."}finally{busy=false}
 }},enabled=!busy){Text("Check payment status")}
 message?.let{Text(it)}
}

@Composable private fun CashfreeReceiptButton(orderId:String){
 val context=LocalContext.current
 val api=remember{ApiClient(SecureSession(context))}
 val scope=rememberCoroutineScope()
 var busy by remember{mutableStateOf(false)}
 var message by remember{mutableStateOf<String?>(null)}
 val launcher=androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.CreateDocument("application/pdf")){uri->
  if(uri!=null){busy=true;scope.launch{try{
   val bytes=api.cashfreeReceipt(orderId)
   kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO){context.contentResolver.openOutputStream(uri)?.use{it.write(bytes)}?:error("Unable to save receipt")}
   message="Test receipt saved."
  }catch(e:Exception){message="Unable to save receipt. Try again."}finally{busy=false}}}
 }
 OutlinedButton({launcher.launch("sandbox-receipt-"+orderId+".pdf")},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Downloading..." else "Download test receipt (PDF)")}
 message?.let{Text(it)}
}

@Composable private fun SavedBillingCart(back:()->Unit,checkout:(BillingQuote,Int)->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var savedSelection by remember{mutableStateOf<JsonObject?>(null)};var selection by remember{mutableStateOf<JsonObject?>(null)};var quote by remember{mutableStateOf<BillingQuote?>(null)};var revision by remember{mutableStateOf(0)};var busy by remember{mutableStateOf(true)};var error by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(Unit){try{val cart=api.billingCart();revision=cart["revision"]!!.jsonPrimitive.int;selection=cart["selection"] as? JsonObject;savedSelection=selection;quote=cart["quote"]?.takeUnless{it==JsonNull}?.let{Json{ignoreUnknownKeys=true}.decodeFromString<BillingQuote>(it.toString())}}catch(e:Exception){error="Unable to load cart."}finally{busy=false}}
 Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
 TextButton(back){Text("← Billing & Subscription")};Text("Shopping Cart",style=MaterialTheme.typography.headlineSmall)
 if(busy)CircularProgressIndicator() else if(quote==null)Text("Your cart is empty.") else quote?.let{q->
 Text(q.kind.replace('_',' '));Text(periodLabel(q.billingPeriod));Text("Admin ${q.adminSeats} · Manager ${q.managerSeats} · Sales ${q.salesSeats} · Telecaller ${q.telecallerSeats}");Text("Account packages: ${q.quantity?:q.accountPackages}");Text("Total ₹${q.totalAmount}")
 selection?.let{saved->val fields=if(q.kind=="ACCOUNT_PACKAGE")listOf("quantity") else listOf("adminSeats","managerSeats","salesSeats","telecallerSeats","accountPackages");fields.forEach{field->val value=saved[field]?.jsonPrimitive?.int?:0;Row(verticalAlignment=Alignment.CenterVertically){Text(field,Modifier.weight(1f));TextButton({selection=JsonObject(saved+ (field to JsonPrimitive((value-1).coerceAtLeast(if(field=="quantity")1 else 0))))}){Text("−")};Text(value.toString());TextButton({selection=JsonObject(saved+(field to JsonPrimitive(value+1)))}){Text("+")}}};OutlinedButton({busy=true;scope.launch{try{val updated=api.updateBillingCart(revision,saved);revision=updated["revision"]!!.jsonPrimitive.int;selection=updated["selection"] as? JsonObject;savedSelection=selection;quote=updated["quote"]?.takeUnless{it==JsonNull}?.let{Json{ignoreUnknownKeys=true}.decodeFromString<BillingQuote>(it.toString())}}catch(e:Exception){error="Unable to update cart."}finally{busy=false}}}){Text("Update cart")}}
 if(selection!=savedSelection)Text("Save your changes before checkout.");Button({checkout(q,revision)},enabled=selection==savedSelection&&!busy,modifier=Modifier.fillMaxWidth()){Text("Proceed to Payment")}
 OutlinedButton({busy=true;scope.launch{try{val cleared=api.updateBillingCart(revision,JsonNull);revision=cleared["revision"]!!.jsonPrimitive.int;selection=null;savedSelection=null;quote=null}catch(e:Exception){error="Unable to clear cart. Reopen and try again."}finally{busy=false}}}){Text("Remove selection")}
 };error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 }
}

@Composable private fun AndroidPaymentResult(order:OnlineOrderResponse,opening:Boolean,launchError:String?,back:()->Unit){
 val context=LocalContext.current
 val api=remember{ApiClient(SecureSession(context))}
 var result by remember(order.id){mutableStateOf<JsonObject?>(null)}
 var checking by remember(order.id){mutableStateOf(false)}
 var message by remember(order.id){mutableStateOf<String?>(null)}
 var retry by remember(order.id){mutableStateOf(0)}
 LaunchedEffect(order.id,opening,retry){
  if(!opening){
   checking=true
   try{
    repeat(30){
     val response=runCatching{api.cashfreeCheckout(order.id,"verify")}.getOrNull()
     if(response?.get("verified")?.jsonPrimitive?.content=="true"){result=response;return@LaunchedEffect}
     kotlinx.coroutines.delay(3000)
    }
    message="Payment not confirmed yet. You can check again or recover it from Payment History."
   }finally{checking=false}
  }
 }
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
   val verified=result
   Text(if(verified!=null)"Payment successful" else if(opening)"Opening secure payment…" else "Verifying payment",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
   if(verified!=null){
    Text("₹"+(verified["amount"]?.jsonPrimitive?.contentOrNull?:order.totalAmount),style=MaterialTheme.typography.headlineMedium)
    Text("Order ID: "+order.id)
    Text("Payment ID: "+(verified["paymentId"]?.jsonPrimitive?.contentOrNull?:""))
    Text("Payment date: "+(verified["capturedAt"]?.jsonPrimitive?.contentOrNull?:""))
    Text("Paid · Subscription activated")
    Button(back,Modifier.fillMaxWidth()){Text("Back to Billing & Subscription")}
    CashfreeReceiptButton(order.id)
   }else{
    if(opening||checking)CircularProgressIndicator()
    launchError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
    message?.let{Text(it)}
    if(!opening&&!checking)Button({retry++},modifier=Modifier.fillMaxWidth()){Text("Check payment status")}
    OutlinedButton(back,Modifier.fillMaxWidth()){Text("Back to Billing & Subscription")}
   }
  }}
 }
}
