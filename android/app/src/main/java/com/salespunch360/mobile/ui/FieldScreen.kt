package com.salespunch360.mobile.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import java.io.ByteArrayOutputStream
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.FieldViewModel
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.location.currentDeviceLocation
import com.salespunch360.mobile.location.locationFailureMessage
import kotlinx.coroutines.launch

private fun compressedBitmap(source:Bitmap):ByteArray{
 val scale=minOf(1f,720f/maxOf(source.width,source.height))
 val result=if(scale<1f)Bitmap.createScaledBitmap(source,(source.width*scale).toInt(),(source.height*scale).toInt(),true)else source
 val format=if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.R)Bitmap.CompressFormat.WEBP_LOSSY else @Suppress("DEPRECATION") Bitmap.CompressFormat.WEBP
 return ByteArrayOutputStream().use{result.compress(format,58,it);if(result!==source)result.recycle();source.recycle();it.toByteArray()}
}

@Composable
fun CustomersScreen(openCheckIns:()->Unit={},vm:FieldViewModel=viewModel()){
 val state=vm.state.collectAsStateWithLifecycle().value
 val context=state.context
 if(context==null&&state.loading){LoadingScreen("Loading customers…");return}
 if(context==null){RetryScreen(state.message?:"Customers couldn't be loaded.",vm::refresh);return}
 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Text("Customers",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)}
  if(context.customers.isEmpty())item{OutlinedCard(Modifier.fillMaxWidth()){Box(Modifier.fillMaxWidth().padding(vertical=32.dp,horizontal=16.dp)){Text("No customers are assigned to you.",color=SalesMuted)}}}
  items(context.customers,key={it.id}){c->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){Text(c.name,fontWeight=FontWeight.Bold,color=SalesInk);Text(c.phone?:"No phone number",color=SalesMuted)}}}
 }
}

@Composable
fun FieldScreen(
 initialFollowUpTask:FollowUpTask?=null,
 onInitialFollowUpConsumed:()->Unit={},
 initialLead:LeadSummary?=null,
 onInitialLeadConsumed:()->Unit={},
 onCheckoutSuccess:(String?)->Unit={},
 vm:FieldViewModel=viewModel(),
 onBack:(()->Unit)?=null,
){
 val state=vm.state.collectAsStateWithLifecycle().value
 val context=state.context
 var type by remember{mutableStateOf("NEW")}
 var subjectId by remember{mutableStateOf<String?>(null)}
 var linkedLeadId by remember{mutableStateOf<String?>(null)}
 var followUpTaskId by remember{mutableStateOf<String?>(null)}
 var name by remember{mutableStateOf("")}
 var phone by remember{mutableStateOf("")}
 var notes by remember{mutableStateOf("")}
 var photo by remember{mutableStateOf<ByteArray?>(null)}
 var locationState by remember{mutableStateOf("getting")}
 var permissionAction by remember{mutableStateOf<(() -> Unit)?>(null)}
 val androidContext=LocalContext.current
 val scope=rememberCoroutineScope()
 val camera=rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()){bitmap->photo=bitmap?.let(::compressedBitmap)}
 val cameraPermission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){if(it)camera.launch(null)else vm.locationError("Camera permission is required. Check-in photos must be taken with the camera.")}
 val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){if(it[Manifest.permission.ACCESS_FINE_LOCATION]==true)permissionAction?.invoke()else{locationState="unavailable";vm.locationError("Precise location is required.")}}

 fun resetForm(nextType:String=type){type=nextType;subjectId=null;linkedLeadId=null;followUpTaskId=null;name="";phone="";notes="";photo=null}
 LaunchedEffect(Unit){locationState="getting";runCatching{currentDeviceLocation(androidContext)}.onSuccess{locationState="ready"}.onFailure{locationState="unavailable"}}
 LaunchedEffect(initialFollowUpTask?.id){initialFollowUpTask?.let{resetForm("FOLLOW_UP");subjectId=it.leadId;followUpTaskId=it.id;onInitialFollowUpConsumed()}}
 LaunchedEffect(initialLead?.id,state.loading){initialLead?.takeIf{!state.loading}?.let{lead->resetForm("NEW");subjectId=lead.id;linkedLeadId=lead.id;name=lead.contactName?:lead.title;phone=lead.phone.orEmpty();onInitialLeadConsumed()}}

 if(context==null&&state.loading){LoadingScreen("Loading check-ins…");return}
 if(context==null){RetryScreen(state.message?:"Check-ins couldn't be loaded.",vm::refresh);return}
 val open=context.visits.filter{it.checkedOutAt==null}
 val selectedCustomer=context.customers.firstOrNull{it.id==subjectId}
 val selectedFollowUp=state.followUps.firstOrNull{it.id==followUpTaskId}
 val requiredPhoto=(type=="NEW"&&linkedLeadId==null)||(type=="CUSTOMER"&&selectedCustomer?.checkInReferenceSetAt==null)
 val canSubmit=!state.busy&&when(type){"NEW"->name.isNotBlank()&&(!requiredPhoto||photo!=null);"FOLLOW_UP"->selectedFollowUp!=null;else->subjectId!=null&&(!requiredPhoto||photo!=null)}

 LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)){
    onBack?.let{back->OutlinedButton(back,contentPadding=PaddingValues(0.dp),modifier=Modifier.size(42.dp)){Text("‹",style=MaterialTheme.typography.headlineSmall)}}
    Text("Check-ins",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=SalesInk)
   }
   HorizontalDivider(Modifier.padding(top=10.dp),color=SalesLine)
  }
  item{
   SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()){
    listOf("NEW" to "New","FOLLOW_UP" to "Follow-up","CUSTOMER" to "Customer").forEachIndexed{i,(value,label)->
     SegmentedButton(selected=type==value,onClick={resetForm(value)},shape=SegmentedButtonDefaults.itemShape(i,3)){Text(label)}
    }
   }
  }
  item{
   Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.cardColors(containerColor=androidx.compose.ui.graphics.Color.White),border=BorderStroke(1.dp,SalesLine)){
    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
     Column(verticalArrangement=Arrangement.spacedBy(5.dp)){
      Text("ADD CHECK-IN",style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.ExtraBold,color=SalesBlue)
      Text(when(type){"FOLLOW_UP"->"Follow-up";"CUSTOMER"->"Customer";else->"New"},style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk)
      StatusChip(when(locationState){"getting"->"Getting current location…";"ready"->"Location ready";else->"Location unavailable"})
     }
     when(type){
      "NEW"->{
       if(linkedLeadId!=null)Text("Existing Lead · current GPS must be within 50 m of the saved visit location.",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
       Text("Name",fontWeight=FontWeight.SemiBold,color=SalesInk)
       OutlinedTextField(name,{name=it},placeholder={Text("Name")},readOnly=linkedLeadId!=null,singleLine=true,modifier=Modifier.fillMaxWidth())
       Text("Phone",fontWeight=FontWeight.SemiBold,color=SalesInk)
       OutlinedTextField(phone,{phone=it},placeholder={Text("Phone")},readOnly=linkedLeadId!=null,singleLine=true,modifier=Modifier.fillMaxWidth())
      }
      "FOLLOW_UP"->{
       Text("Scheduled visit follow-up",fontWeight=FontWeight.SemiBold)
       FollowUpSelector(state.followUps,followUpTaskId){task->subjectId=task.leadId;followUpTaskId=task.id}
      }
      "CUSTOMER"->{
       Text("Customer",fontWeight=FontWeight.SemiBold)
       CustomerSelector(context.customers,subjectId){subjectId=it;photo=null}
      }
     }
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.Bottom){
      Text("Photo",fontWeight=FontWeight.Bold)
      Text(when{type=="FOLLOW_UP"||linkedLeadId!=null->"Optional";type=="CUSTOMER"->"Required for first check-in";else->"Required"},style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
     val dashColor=SalesLine
     Box(
      Modifier.fillMaxWidth().heightIn(min=118.dp).drawBehind{
       drawRoundRect(
        color=dashColor,
        cornerRadius=androidx.compose.ui.geometry.CornerRadius(12.dp.toPx()),
        style=Stroke(width=1.5.dp.toPx(),pathEffect=PathEffect.dashPathEffect(floatArrayOf(12f,8f)))
       )
      }.padding(18.dp),
      contentAlignment=Alignment.Center
     ){
      Button({if(ContextCompat.checkSelfPermission(androidContext,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)camera.launch(null)else cameraPermission.launch(Manifest.permission.CAMERA)}){
       Text(if(photo==null)"Take Photo" else "Retake Photo")
      }
     }
     photo?.let{bytes->
      val preview=remember(bytes){android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)}
      Image(preview.asImageBitmap(),"Captured check-in photo preview",Modifier.fillMaxWidth().height(180.dp),contentScale=ContentScale.Crop)
      TextButton({photo=null},Modifier.fillMaxWidth()){Text("Remove Photo")}
     }
     Column(verticalArrangement=Arrangement.spacedBy(1.dp)){
      Text("Notes",fontWeight=FontWeight.Bold)
      Text("Optional",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
     }
     OutlinedTextField(notes,{notes=it.take(2000)},placeholder={Text("Add visit details")},modifier=Modifier.fillMaxWidth(),minLines=3)
     Button({
      permissionAction={scope.launch{
       locationState="getting"
       runCatching{currentDeviceLocation(androidContext)}.onSuccess{point->
        locationState="ready"
        vm.checkIn(type,subjectId,name.ifBlank{null},phone.ifBlank{null},point,notes.ifBlank{null},photo,followUpTaskId)
        if(type=="NEW"&&linkedLeadId==null){name="";phone=""}
        notes="";photo=null
       }.onFailure{locationState="unavailable";vm.locationError(locationFailureMessage(it))}
      }}
      permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))
     },enabled=canSubmit,modifier=Modifier.fillMaxWidth()){
      Icon(Icons.Default.LocationOn,null)
      Text(if(state.busy)" Checking in…" else " Check In Now")
     }
    }
   }
  }
  state.message?.let{item{MessageBanner(it,vm::clear)}}
  item{Column{Text("Pending Checkout",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=SalesInk);Text("Complete before your next visit",style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}
  if(open.isEmpty())item{Text("No open visits.",color=SalesMuted)}
  items(open,key={it.id}){v->PendingCheckoutCard(v,state.busy,vm::addPhone){sentiment,remarks->
   permissionAction={scope.launch{
    locationState="getting"
    runCatching{currentDeviceLocation(androidContext)}.onSuccess{point->locationState="ready";vm.checkout(v.id,point,sentiment,remarks){onCheckoutSuccess(v.leadId)}}.onFailure{locationState="unavailable";vm.locationError(locationFailureMessage(it))}
   }}
   permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))
  }}
 }
}

@Composable
private fun PendingCheckoutCard(v:FieldVisit,busy:Boolean,addPhone:(String,String)->Unit,checkout:(VisitSentiment,String?)->Unit){
 var phone by remember(v.id){mutableStateOf("")}
 var sentiment by remember(v.id){mutableStateOf<VisitSentiment?>(null)}
 var remarks by remember(v.id){mutableStateOf("")}
 var resultMenu by remember{mutableStateOf(false)}
 OutlinedCard(Modifier.fillMaxWidth()){
  Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text(v.customer?.name?:v.contactName?:"Field prospect",fontWeight=FontWeight.Bold)
   Text(formatFieldTime(v.checkedInAt),color=SalesMuted)
   Text(v.checkInAddress?:if(v.checkInLatitude!=null&&v.checkInLongitude!=null)"%.5f, %.5f".format(v.checkInLatitude,v.checkInLongitude) else "Captured visit location unavailable",style=MaterialTheme.typography.bodySmall,color=SalesMuted)
   if(v.leadId==null){
    OutlinedTextField(phone,{phone=it},placeholder={Text("Add phone to create Lead")},singleLine=true,modifier=Modifier.fillMaxWidth())
    OutlinedButton({addPhone(v.id,phone.trim())},enabled=!busy&&phone.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text("Add phone")}
   }
   Text("Outcome",fontWeight=FontWeight.SemiBold,color=SalesInk)
   Box{
    OutlinedButton({resultMenu=true},Modifier.fillMaxWidth()){Text(sentiment?.name?.lowercase()?.replaceFirstChar{it.uppercase()}?:"Select outcome",Modifier.fillMaxWidth())}
    DropdownMenu(resultMenu,{resultMenu=false}){VisitSentiment.entries.forEach{s->DropdownMenuItem({Text(s.name.lowercase().replaceFirstChar{it.uppercase()})},{sentiment=s;resultMenu=false})}}
   }
   OutlinedTextField(remarks,{remarks=it.take(2000)},placeholder={Text("Optional remarks")},modifier=Modifier.fillMaxWidth(),minLines=2)
   Button({sentiment?.let{checkout(it,remarks.ifBlank{null})}},enabled=!busy&&sentiment!=null,modifier=Modifier.fillMaxWidth()){Text("Checkout with current location")}
  }
 }
}

@Composable
private fun FollowUpSelector(tasks:List<FollowUpTask>,selected:String?,change:(FollowUpTask)->Unit){
 var expanded by remember{mutableStateOf(false)}
 val current=tasks.firstOrNull{it.id==selected}
 Box{
  OutlinedButton({expanded=true},Modifier.fillMaxWidth()){
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
    Text(current?.let{"${followUpBucket(it)} · ${it.leadTitle} · ${it.dueDate.take(10)}"}?:if(tasks.isEmpty())"No scheduled visit follow-ups" else "Select scheduled visit follow-up",Modifier.weight(1f))
    Text("▼")
   }
  }
  DropdownMenu(expanded,{expanded=false}){tasks.forEach{task->DropdownMenuItem({Text("${followUpBucket(task)} · ${task.leadTitle} · ${task.dueDate.take(10)}")},{change(task);expanded=false})}}
 }
}

@Composable
private fun CustomerSelector(customers:List<Customer>,selected:String?,change:(String)->Unit){
 var expanded by remember{mutableStateOf(false)}
 val current=customers.firstOrNull{it.id==selected}
 Box{
  OutlinedButton({expanded=true},Modifier.fillMaxWidth()){
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
    Text(current?.let{it.name+if(it.checkInReferenceSetAt==null)" — first check-in (photo required)" else ""}?:"Select your assigned customer",Modifier.weight(1f))
    Text("▼")
   }
  }
  DropdownMenu(expanded,{expanded=false}){customers.forEach{c->DropdownMenuItem({Text(c.name+if(c.checkInReferenceSetAt==null)" — first check-in (photo required)" else "")},{change(c.id);expanded=false})}}
 }
}

private fun followUpBucket(task:FollowUpTask):String{
 val due=task.dueDate.take(10)
 val today=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString()
 return when{due<today->"Overdue";due==today->"Due Today";else->"Upcoming"}
}

private fun formatFieldTime(value:String):String=runCatching{
 java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))
}.getOrDefault(value)
