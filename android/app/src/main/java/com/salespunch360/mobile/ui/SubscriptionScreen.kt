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

@Composable fun SubscriptionScreen(){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var data by remember{mutableStateOf<MobileBillingContext?>(null)};var error by remember{mutableStateOf<String?>(null)};var loading by remember{mutableStateOf(true)}
 fun reload(){loading=true;error=null;scope.launch{runCatching{api.billing()}.onSuccess{data=it}.onFailure{error="Unable to load subscription."};loading=false}}
 LaunchedEffect(Unit){runCatching{api.billing()}.onSuccess{data=it}.onFailure{error="Unable to load subscription."};loading=false}
 when{loading->Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator()};error!=null->RetryScreen(error!!,::reload);else->SubscriptionContent(data!!,::reload)}
}

@Composable private fun SubscriptionContent(data:MobileBillingContext,reload:()->Unit){
 var checkout by remember{mutableStateOf<BillingQuote?>(null)};var editing by remember{mutableStateOf<String?>(null)};var showOrders by remember{mutableStateOf(false)}
 if(checkout!=null){CheckoutCard(checkout!!){checkout=null;reload()};return}
 val pending=data.orders.firstOrNull{it.status=="PENDING"}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=14.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
  item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text("Subscription",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);pending?.let{StatusChip("Payment Pending")}}}
  if(pending!=null)item{Surface(Modifier.fillMaxWidth(),shape=MaterialTheme.shapes.medium,color=MaterialTheme.colorScheme.secondaryContainer){Text("Ref ${pending.id.take(8).uppercase()} · ₹${pending.totalAmount}",Modifier.padding(10.dp),style=MaterialTheme.typography.bodySmall)}}
  if(data.hasSales)item{CompactSalesSummary(data.sales,data.teamStructure){editing=if(editing=="SALES")null else "SALES"};if(editing=="SALES")SalesPurchase(data){checkout=it}}
  if(data.hasAccount)item{CompactAccountSummary(data.account,data.isPlus){editing=if(data.isPlus)"SALES" else if(editing=="ACCOUNT")null else "ACCOUNT"};if(editing=="ACCOUNT"&&!data.isPlus)AccountPurchase(data){checkout=it};if(data.isPlus&&editing=="SALES"&&!data.hasSales)SalesPurchase(data){checkout=it}}
  item{OutlinedButton({showOrders=!showOrders},Modifier.fillMaxWidth()){Text(if(showOrders)"Hide Payment History" else "Payment History")}}
  if(showOrders)items(data.orders.take(8)){o->Text("${periodLabel(o.billingPeriod)} · ₹${o.totalAmount} · ${o.status}",style=MaterialTheme.typography.bodySmall)}
 }
}

@Composable private fun CompactSalesSummary(s:MobileSalesSubscription?,structure:TeamStructure,manage:()->Unit){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Sales Subscription",fontWeight=FontWeight.Bold);StatusChip(s?.status?:"INACTIVE")};s?.endsAt?.let{Text("Valid until ${it.take(10)}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){SeatPill("Admin",s?.adminUsage?:0,s?.adminLimit?:0);if(structure!=TeamStructure.SALES_ONLY)SeatPill("Manager",s?.managerUsage?:0,s?.managerLimit?:0);SeatPill("Sales",s?.salesUsage?:0,s?.salesLimit?:0)};Button(manage,Modifier.fillMaxWidth()){Text("Add / Renew Sales Seats")}}}}
@Composable private fun CompactAccountSummary(a:MobileAccountSubscription?,plus:Boolean,manage:()->Unit){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Account Subscription",fontWeight=FontWeight.Bold);StatusChip(a?.status?:"INACTIVE")};a?.endsAt?.let{Text("Valid until ${it.take(10)} · ${a.packageCount} package${if(a.packageCount==1)"" else "s"}",style=MaterialTheme.typography.bodySmall,color=SalesMuted)};FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){SeatPill("Account Admin",a?.accountAdminUsage?:0,a?.accountAdminLimit?:0);SeatPill("Accountant",a?.accountantUsage?:0,a?.accountantLimit?:0);SeatPill("Project Manager",a?.projectManagerUsage?:0,a?.projectManagerLimit?:0);SeatPill("Data Entry",a?.dataEntryUsage?:0,a?.dataEntryLimit?:0)};Button(manage,Modifier.fillMaxWidth()){Text(if(plus)"Manage with Plus Renewal" else "Add / Renew Account Seats")}}}}
@Composable private fun SeatPill(label:String,used:Int,limit:Int){Surface(shape=MaterialTheme.shapes.small,color=SalesPale){Text("$label  $used / $limit",Modifier.padding(horizontal=8.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall)}}

@Composable private fun SalesPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var period by remember{mutableStateOf("SIX_MONTH")};val s=data.sales;var admins by remember{s.mutableStateOfSafe(s?.adminLimit?:s?.adminUsage?:0)};var managers by remember{s.mutableStateOfSafe(if(data.teamStructure==TeamStructure.SALES_ONLY)0 else s?.managerLimit?:s?.managerUsage?:0)};var sales by remember{s.mutableStateOfSafe(s?.salesLimit?:s?.salesUsage?:1)};var accounts by remember{mutableStateOf((data.account?.packageCount?:1).coerceAtLeast(1).toString())};var busy by remember{mutableStateOf(false)}
 ContentCard("Sales Seats","Only 6 Month and Yearly plans are available."){PeriodSelector(period){period=it};NumberField("Additional Admin",admins){admins=it};if(data.teamStructure!=TeamStructure.SALES_ONLY)NumberField("Manager",managers){managers=it};NumberField("Sales",sales){sales=it};if(data.isPlus)NumberField("Account Packages",accounts){accounts=it};Button({busy=true;scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(billingPeriod=period,adminSeats=admins.toIntOrNull()?:0,managerSeats=managers.toIntOrNull()?:0,salesSeats=sales.toIntOrNull()?:0,accountPackages=if(data.isPlus)accounts.toIntOrNull()?:1 else 0))}.onSuccess(onQuote);busy=false}},enabled=!busy&&(sales.toIntOrNull()?:0)+(managers.toIntOrNull()?:0)>0,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Calculating…" else "Review Checkout")}}
}
private fun <T> T.mutableStateOfSafe(value:Int)=mutableStateOf(value.toString())

@Composable private fun AccountPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit){val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var period by remember{mutableStateOf("SIX_MONTH")};var quantity by remember{mutableStateOf("1")};var busy by remember{mutableStateOf(false)};val six=data.prices.firstOrNull{it.role=="ACCOUNT_PACKAGE"&&it.period=="SIX_MONTH"}?.amount?:"400.00";val year=data.prices.firstOrNull{it.role=="ACCOUNT_PACKAGE"&&it.period=="YEARLY"}?.amount?:"700.00";ContentCard("Account Packages","6 Months ₹$six · Yearly ₹$year per package."){PeriodSelector(period){period=it};NumberField("Additional packages",quantity){quantity=it};Button({busy=true;scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(kind="ACCOUNT_PACKAGE",billingPeriod=period,quantity=quantity.toIntOrNull()?.coerceIn(1,100)?:1))}.onSuccess(onQuote);busy=false}},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Calculating…" else "Review Checkout")}}}
@Composable private fun PeriodSelector(period:String,change:(String)->Unit){Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("SIX_MONTH" to "6 Month","YEARLY" to "Yearly").forEach{(value,label)->FilterChip(selected=period==value,onClick={change(value)},label={Text(label)})}}}
@Composable private fun NumberField(label:String,value:String,change:(String)->Unit){OutlinedTextField(value,{change(it.filter(Char::isDigit).take(5))},label={Text(label)},singleLine=true,modifier=Modifier.fillMaxWidth())}
private fun periodLabel(value:String)=when(value){"SIX_MONTH"->"6 Month";"YEARLY"->"Yearly";else->value.replace('_',' ')}

@Composable private fun CheckoutCard(q:BillingQuote,back:()->Unit){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope();var pending by remember{mutableStateOf<ManualOrderResponse?>(null)};var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 pending?.let{order->LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Text("Payment Pending",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard("Manual Payment","Order ref ${order.id.take(8).uppercase()}"){Text("₹${order.totalAmount}",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold);Text("Awaiting Super Admin payment verification.",style=MaterialTheme.typography.bodySmall)};Button(back,Modifier.fillMaxWidth()){Text("Back to Subscription")}}};return}
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{TextButton(back){Text("← Subscription")};Text("Checkout",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);ContentCard("Review","${q.kind.replace('_',' ')} · ${periodLabel(q.billingPeriod)}"){q.salesSubtotal?.let{Text("Sales subtotal ₹$it")};q.accountSubtotal?.let{Text("Account subtotal ₹$it")};Text("Total payable",style=MaterialTheme.typography.bodySmall);Text("₹${q.totalAmount}",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)}}
  item{ContentCard("Manual Payment","Super Admin activates the subscription after verification."){error?.let{Text(it,color=MaterialTheme.colorScheme.error)};Button({busy=true;error=null;scope.launch{val key="android_"+java.util.UUID.randomUUID().toString().replace("-","");val request=ManualOrderRequest(kind=q.kind,billingPeriod=q.billingPeriod,adminSeats=q.adminSeats,managerSeats=q.managerSeats,salesSeats=q.salesSeats,accountPackages=q.accountPackages,quantity=if(q.kind=="ACCOUNT_PACKAGE")q.quantity else null,idempotencyKey=key);runCatching{api.createManualOrder(request)}.onSuccess{pending=it}.onFailure{error="Unable to create payment request."};busy=false}},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text(if(busy)"Creating…" else "Manual Payment")}}}
 }
}
