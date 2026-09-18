package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.*
@Composable
fun SubscriptionScreen(){
    val context=LocalContext.current
    val api=remember{ApiClient(SecureSession(context))}
    val scope=rememberCoroutineScope()
    var data by remember{mutableStateOf<MobileBillingContext?>(null)}
    var error by remember{mutableStateOf<String?>(null)}
    var loading by remember{mutableStateOf(true)}
    LaunchedEffect(Unit){
        runCatching{api.billing()}.onSuccess{data=it}.onFailure{error="Unable to load subscription."}
        loading=false
    }
    when{
        loading->Box(Modifier.fillMaxSize(),contentAlignment=androidx.compose.ui.Alignment.Center){CircularProgressIndicator()}
        error!=null->RetryScreen(error!!,{
            error=null
            loading=true
            scope.launch{
                runCatching{api.billing()}.onSuccess{data=it;error=null}.onFailure{error="Unable to load subscription."}
                loading=false
            }
        })
        else->SubscriptionContent(data!!)
    }
}


@Composable
private fun SubscriptionContent(data:MobileBillingContext){
    var checkout by remember{mutableStateOf<BillingQuote?>(null)}
    if(checkout!=null){CheckoutCard(checkout!!){checkout=null};return}
    val pending=data.orders.firstOrNull{it.status=="PENDING"}
    LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
        item{
            Text("Subscription",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
            if(pending!=null){
                Card(Modifier.fillMaxWidth()){
                    Column(Modifier.padding(14.dp)){
                        Text("Payment Pending",fontWeight=FontWeight.Bold)
                        Text("Ref ${pending.id.take(8).uppercase()} · ₹${pending.totalAmount}")
                        Text("Continue this pending payment. A new order will not be created while it is active.",style=MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        if(data.hasSales)item{SalesPurchase(data){checkout=it}}
        if(data.hasAccount)item{AccountPurchase(data){checkout=it}}
        item{Text("Recent orders",fontWeight=FontWeight.Bold)}
        items(data.orders.take(8)){o->Text("${o.billingPeriod.replace('_',' ')} · ₹${o.totalAmount} · ${o.status}",style=MaterialTheme.typography.bodySmall)}
    }
}
@Composable
private fun SalesPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit){
    val context=LocalContext.current
    val api=remember{ApiClient(SecureSession(context))}
    val scope=rememberCoroutineScope()
    var period by remember{mutableStateOf("MONTHLY")}
    var admins by remember{mutableStateOf("1")}
    var managers by remember{mutableStateOf(if(data.teamStructure==TeamStructure.SALES_ONLY)"0" else "1")}
    var sales by remember{mutableStateOf("5")}
    ContentCard("Sales Subscription","Choose seats and review before payment."){
        Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
            listOf("MONTHLY","SIX_MONTH","YEARLY").forEach{p->
                FilterChip(selected=period==p,onClick={period=p},label={Text(p.replace('_',' '))})
            }
            OutlinedTextField(value=admins,onValueChange={admins=it.filter(Char::isDigit)},label={Text("Additional Admin")},modifier=Modifier.fillMaxWidth())
            if(data.teamStructure!=TeamStructure.SALES_ONLY){
                OutlinedTextField(value=managers,onValueChange={managers=it.filter(Char::isDigit)},label={Text("Manager")},modifier=Modifier.fillMaxWidth())
            }
            OutlinedTextField(value=sales,onValueChange={sales=it.filter(Char::isDigit)},label={Text("Sales")},modifier=Modifier.fillMaxWidth())
            Button(onClick={
                scope.launch{
                    runCatching{
                        api.billingQuote(BillingQuoteRequest(
                            billingPeriod=period,
                            adminSeats=admins.toIntOrNull()?:0,
                            managerSeats=managers.toIntOrNull()?:0,
                            salesSeats=sales.toIntOrNull()?:0
                        ))
                    }.onSuccess(onQuote)
                }
            },modifier=Modifier.fillMaxWidth()){Text("Continue to Checkout")}
        }
    }
}
@Composable
private fun AccountPurchase(data:MobileBillingContext,onQuote:(BillingQuote)->Unit){
    val context=LocalContext.current
    val api=remember{ApiClient(SecureSession(context))}
    val scope=rememberCoroutineScope()
    var quantity by remember{mutableStateOf("1")}
    val unit=data.prices.firstOrNull{it.role=="ACCOUNT_PACKAGE"&&it.period=="YEARLY"}?.amount?:"700.00"
    ContentCard("Account Subscription","₹$unit / package / year · fixed Account-role seats."){
        Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
            OutlinedTextField(value=quantity,onValueChange={quantity=it.filter(Char::isDigit)},label={Text("Additional packages")},modifier=Modifier.fillMaxWidth())
            Button(onClick={scope.launch{runCatching{api.billingQuote(BillingQuoteRequest(kind="ACCOUNT_PACKAGE",quantity=quantity.toIntOrNull()?:1))}.onSuccess(onQuote)}},modifier=Modifier.fillMaxWidth()){Text("Continue to Checkout")}
        }
    }
}
@Composable
private fun CheckoutCard(q:BillingQuote,back:()->Unit){
    val context=LocalContext.current
    val api=remember{ApiClient(SecureSession(context))}
    val scope=rememberCoroutineScope()
    var pending by remember{mutableStateOf<ManualOrderResponse?>(null)}
    var busy by remember{mutableStateOf(false)}
    var error by remember{mutableStateOf<String?>(null)}
    val pendingOrder=pending
    if(pendingOrder!=null){
        LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            item{
                Text("Payment Pending",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                ContentCard("Manual Payment","Order ref ${pendingOrder.id.take(8).uppercase()}"){
                    Text("₹${pendingOrder.totalAmount}",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)
                    Text("Awaiting Super Admin payment verification. Do not create another payment request.",style=MaterialTheme.typography.bodySmall)
                }
                Button(onClick=back,modifier=Modifier.fillMaxWidth()){Text("Back to Subscription")}
            }
        }
        return
    }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
        item{
            TextButton(onClick=back){Text("← Subscription")}
            Text("Checkout",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
            ContentCard("Review","${q.kind.replace('_',' ')} · ${q.billingPeriod.replace('_',' ')}"){
                Text("Total payable",style=MaterialTheme.typography.bodySmall)
                Text("₹${q.totalAmount}",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)
            }
        }
        item{ContentCard("Online Payment","Coming Soon"){Button(onClick={},enabled=false,modifier=Modifier.fillMaxWidth()){Text("Coming Soon")}}}
        item{
            ContentCard("Manual Payment","Super Admin activates the subscription only after verifying payment."){
                error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
                Button(onClick={
                    busy=true
                    error=null
                    scope.launch{
                        val key="android_"+java.util.UUID.randomUUID().toString().replace("-","")
                        val request=if(q.kind=="ACCOUNT_PACKAGE"){
                            ManualOrderRequest(kind=q.kind,billingPeriod="YEARLY",quantity=q.quantity?:1,idempotencyKey=key)
                        }else{
                            ManualOrderRequest(billingPeriod=q.billingPeriod,adminSeats=q.adminSeats,managerSeats=q.managerSeats,salesSeats=q.salesSeats,idempotencyKey=key)
                        }
                        runCatching{api.createManualOrder(request)}
                            .onSuccess{pending=it}
                            .onFailure{error="Unable to create payment request."}
                        busy=false
                    }
                },enabled=!busy,modifier=Modifier.fillMaxWidth()){
                    Text(if(busy)"Creating…" else "Manual Payment")
                }
            }
        }
    }
}
