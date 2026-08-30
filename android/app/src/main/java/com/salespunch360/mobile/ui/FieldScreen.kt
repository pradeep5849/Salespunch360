package com.salespunch360.mobile.ui
import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.FieldViewModel
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.location.currentDeviceLocation
import kotlinx.coroutines.launch

@Composable fun FieldScreen(vm:FieldViewModel=viewModel()){val state=vm.state.collectAsStateWithLifecycle().value;val context=state.context;var search by remember{mutableStateOf("")};var selected by remember{mutableStateOf<Customer?>(null)};var checkout by remember{mutableStateOf<FieldVisit?>(null)};var permissionAction by remember{mutableStateOf<(() -> Unit)?>(null)};val androidContext=LocalContext.current;val scope=rememberCoroutineScope();val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){grants->if(grants[Manifest.permission.ACCESS_FINE_LOCATION]==true)permissionAction?.invoke()}
 if(context==null&&state.loading){LoadingScreen("Loading customers…");return};if(context==null){RetryScreen(state.message?:"Customers couldn't be loaded.",vm::refresh);return};val customers=context.customers.filter{it.name.contains(search,true)||it.contactPerson?.contains(search,true)==true};val open=context.visits.filter{it.checkedOutAt==null}
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(10.dp),contentPadding=PaddingValues(vertical=12.dp)){item{OutlinedTextField(search,{search=it},Modifier.fillMaxWidth(),label={Text("Search customers")},singleLine=true,leadingIcon={Icon(Icons.Default.Search,null)});state.message?.let{MessageBanner(it,vm::clear)}};if(open.isNotEmpty())item{ContentCard("Checkout required","Finish your current visit before starting another when company policy requires it."){open.forEach{visit->Button({checkout=visit},Modifier.fillMaxWidth()){Text("Checkout · ${visit.customer.name}")}}}};if(customers.isEmpty())item{ContentCard("No customers found",if(context.customers.isEmpty())"No customers are available for field visits." else "Try a different search.")};items(customers,key={it.id}){customer->OutlinedCard({selected=customer},Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp)){Text(customer.name,style=MaterialTheme.typography.titleMedium,maxLines=1,overflow=TextOverflow.Ellipsis);customer.contactPerson?.let{Text(it)};customer.phone?.let{Text(it)};customer.address?.let{Text(it,maxLines=2,overflow=TextOverflow.Ellipsis)}}}};item{Text("Visit history",style=MaterialTheme.typography.titleLarge)};items(context.visits,key={it.id}){visit->VisitRow(visit)}}
 selected?.let{customer->AlertDialog(onDismissRequest={selected=null},title={Text(customer.name)},text={Column(verticalArrangement=Arrangement.spacedBy(6.dp)){customer.contactPerson?.let{Text("Contact: $it")};customer.phone?.let{Text("Phone: $it")};customer.email?.let{Text(it)};customer.address?.let{Text(it)};Text("A current precise GPS location is required. Photos are not requested because the server has no visit-photo storage field.",style=MaterialTheme.typography.bodySmall)}},confirmButton={Button({permissionAction={scope.launch{runCatching{currentDeviceLocation(androidContext)}.onSuccess{vm.checkIn(customer.id,it,null);selected=null}}};permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))},enabled=!state.busy){Icon(Icons.Default.LocationOn,null);Text(" Check in")}},dismissButton={TextButton({selected=null}){Text("Cancel")}})}
 checkout?.let{visit->CheckoutDialog(visit,state.busy,{checkout=null}){sentiment,remarks->permissionAction={scope.launch{runCatching{currentDeviceLocation(androidContext)}.onSuccess{vm.checkout(visit.id,it,sentiment,remarks);checkout=null}}};permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))}}
}
@Composable private fun VisitRow(visit:FieldVisit){OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){Text(visit.customer.name,style=MaterialTheme.typography.titleMedium);Text("Checked in ${visit.checkedInAt}",style=MaterialTheme.typography.bodySmall);Text(if(visit.checkedOutAt==null)"Awaiting checkout" else "Checked out ${visit.checkedOutAt}");visit.checkoutSentiment?.let{StatusChip(it.name.lowercase().replaceFirstChar{c->c.uppercase()})};visit.checkoutRemarks?.let{Text(it)};visit.visitNotes?.let{Text(it,style=MaterialTheme.typography.bodySmall)}}}}
@Composable private fun CheckoutDialog(visit:FieldVisit,busy:Boolean,dismiss:()->Unit,submit:(VisitSentiment,String?)->Unit){var sentiment by remember{mutableStateOf(VisitSentiment.NEUTRAL)};var remarks by remember{mutableStateOf("")};AlertDialog(onDismissRequest=dismiss,title={Text("Checkout · ${visit.customer.name}")},text={Column(verticalArrangement=Arrangement.spacedBy(10.dp)){SingleChoiceSegmentedButtonRow{VisitSentiment.entries.forEachIndexed{i,item->SegmentedButton(selected=sentiment==item,onClick={sentiment=item},shape=SegmentedButtonDefaults.itemShape(i,3)){Text(item.name.lowercase().replaceFirstChar{it.uppercase()})}}};OutlinedTextField(remarks,{if(it.length<=2000)remarks=it},label={Text("Remarks (optional)")},minLines=3)}},confirmButton={Button({submit(sentiment,remarks.ifBlank{null})},enabled=!busy){Text("Checkout with GPS")}},dismissButton={TextButton(dismiss){Text("Cancel")}})}
