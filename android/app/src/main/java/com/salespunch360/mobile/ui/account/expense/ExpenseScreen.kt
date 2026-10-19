package com.salespunch360.mobile.ui.account.expense
import com.salespunch360.mobile.ExpenseState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Alignment
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription

import com.salespunch360.mobile.ui.account.accountDate
import com.salespunch360.mobile.ui.account.accountMoney
import android.provider.OpenableColumns;import android.content.Intent;import android.net.Uri;import java.io.ByteArrayOutputStream;import java.io.File;import androidx.core.content.FileProvider;import androidx.activity.compose.rememberLauncherForActivityResult;import androidx.activity.result.contract.ActivityResultContracts;import androidx.compose.foundation.clickable;import androidx.compose.foundation.layout.*;import androidx.compose.foundation.lazy.*;import androidx.compose.material.icons.Icons;import androidx.compose.material.icons.filled.*;import androidx.compose.material3.*;import androidx.compose.runtime.*;import androidx.compose.ui.Modifier;import androidx.compose.ui.platform.LocalContext;import androidx.compose.ui.text.font.FontWeight;import androidx.compose.ui.unit.dp;import androidx.lifecycle.compose.collectAsStateWithLifecycle;import androidx.lifecycle.viewmodel.compose.viewModel;import com.salespunch360.mobile.AccountExpenseViewModel;import com.salespunch360.mobile.account.*;import kotlinx.coroutines.Dispatchers;import kotlinx.coroutines.launch;import kotlinx.coroutines.withContext;import kotlinx.serialization.json.*
private const val MAX_EXPENSE_ATTACHMENT_BYTES=10L*1024L*1024L
internal suspend fun readExpenseAttachment(context:android.content.Context,uri:Uri):Triple<String,String,ByteArray> = withContext(Dispatchers.IO){var name="attachment";var declared:Long?=null;context.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)?.use{c->if(c.moveToFirst()){name=c.getString(0)?:name;declared=c.getLong(1).takeIf{it>=0}}};if(declared!=null&&declared!!>MAX_EXPENSE_ATTACHMENT_BYTES)throw IllegalArgumentException("Attachment is larger than 10 MB.");val input=context.contentResolver.openInputStream(uri)?:throw IllegalArgumentException("Attachment could not be opened.");val out=ByteArrayOutputStream(if(declared!=null)minOf(declared!!,MAX_EXPENSE_ATTACHMENT_BYTES).toInt()else 32*1024);input.use{stream->val buffer=ByteArray(32*1024);var total=0L;while(true){val count=stream.read(buffer);if(count<0)break;total+=count;if(total>MAX_EXPENSE_ATTACHMENT_BYTES)throw IllegalArgumentException("Attachment is larger than 10 MB.");out.write(buffer,0,count)};if(total==0L)throw IllegalArgumentException("Attachment is empty.")};Triple(name,context.contentResolver.getType(uri)?:"application/pdf",out.toByteArray())}
@Composable fun ExpenseScreen(padding:PaddingValues,vm:AccountExpenseViewModel=viewModel(),initialQuery:String="",initialExpenseId:String?=null,initialCreate:Boolean=false){LaunchedEffect(initialQuery,initialExpenseId){vm.context(initialQuery);initialExpenseId?.let(vm::open)};val s=vm.state.collectAsStateWithLifecycle().value;var creationOpened by androidx.compose.runtime.saveable.rememberSaveable(initialCreate){mutableStateOf(false)};LaunchedEffect(initialCreate,s.loading,s.options){if(initialCreate&&!creationOpened&&!s.loading&&s.options["canCreateExpense"]?.jsonPrimitive?.booleanOrNull==true){creationOpened=true;vm.create()}};val context=LocalContext.current;var fileError by remember{mutableStateOf<String?>(null)};LaunchedEffect(s.downloaded){s.downloaded?.let{d->try{val file=withContext(Dispatchers.IO){com.salespunch360.mobile.data.safeAttachmentFile(context.cacheDir,d.first).also{target->target.outputStream().buffered().use{it.write(d.second)}}};val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file);context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("application/octet-stream").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share attachment"))}catch(e:Exception){fileError=e.message?:"Attachment could not be prepared."}finally{vm.consumedDownload()}}};Column(Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp)){Row{OutlinedTextField(s.query,vm::search,label={Text("Search expense or reference")},modifier=Modifier.weight(1f));IconButton(vm::refresh){Icon(Icons.Default.Refresh,"Refresh")};IconButton({vm.showRecurring(true)},enabled=!s.saving){Icon(Icons.Default.Repeat,"Recurring schedules")};FilledIconButton(vm::create,enabled=!s.saving&&s.options["canCreateExpense"]?.jsonPrimitive?.booleanOrNull==true){Icon(Icons.Default.Add,"New expense")}};if(s.recurringTemplateId!=null)Row{Text("Recurring bills",Modifier.weight(1f));TextButton(vm::clearRecurringBills){Text("All expenses")}};LazyRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){items(listOf<String?>(null,"DRAFT","PENDING_APPROVAL","APPROVED","POSTED","REJECTED","REVERSED","CANCELLED")){x->FilterChip(s.status==x,{vm.filter(x)},{Text(x?.replace('_',' ')?:"All")})}};LazyRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){items(listOf<String?>(null,"PROJECT_EXPENSE","OFFICE_EXPENSE","OTHER_INCOME","REIMBURSEMENT")){x->FilterChip(s.type==x,{vm.type(x)},{Text(x?.replace('_',' ')?:"All types")})}};LazyRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){item{FilterChip(s.categoryId==null,{vm.category(null)},{Text("All categories")})};items(s.options.array("categories")){category->FilterChip(s.categoryId==category.str("id"),{vm.category(category.str("id"))},{Text(category.str("name"))})}};if(!s.loading&&s.error==null)s.summary?.let{totals->Text("Posted totals · all history");Text("Expense: ${accountMoney(totals.str("expense"))} · Other income: ${accountMoney(totals.str("income"))}");Text(totals.str("recognition"))};Row{Text("${s.rows.size} of ${s.total} transactions",Modifier.weight(1f));if(s.nextOffset!=null)TextButton(vm::loadMore,enabled=!s.loading){Text("Load more")}};if(s.loading)LinearProgressIndicator(Modifier.fillMaxWidth());s.message?.let{Text(it)};fileError?.let{Text(it,color=MaterialTheme.colorScheme.error)};s.error?.let{Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.errorContainer)){Row(Modifier.padding(12.dp)){Text(it,Modifier.weight(1f));TextButton(vm::refresh){Text("Retry")}}}};if(!s.loading&&s.error==null&&s.rows.isEmpty())Text("No expenses match these filters.",Modifier.padding(24.dp));LazyColumn{items(s.rows,key={it.str("id")}){x->ListItem(headlineContent={Text(x.str("transactionNumber"),fontWeight=FontWeight.Bold)},supportingContent={Text("${x.str("transactionDate").take(10)} · ${x.str("type").replace('_',' ')}")},trailingContent={Column{Text(accountMoney(x.str("totalAmount")));Text(x.str("status"))}},modifier=Modifier.clickable{vm.open(x.str("id"))})}}};if(s.recurringOpen)RecurringSchedulesDialog(s,{vm.showRecurring(false)},vm::recurringAction,vm::recurringBills);s.editing?.let{key(s.requestKey){ExpenseEditor(it,s.options,s.saving,s.error,s.newCategoryId,vm::dismiss,{p,n->vm.save(p,n)},{vm.showCategory(true)})}};s.detail?.let{ExpenseDetail(it,s.saving,s.error,vm::dismiss,vm::edit,vm::action,vm::attach,vm::download,vm::recurring,s.options,vm::payRecurring)};if(s.categoryOpen)CategoryEditor(buildJsonObject{},s.options.array("ledgers").map{it.jsonObject},s.saving,s.error,{vm.showCategory(false)},vm::saveCategory)}
@Composable private fun ExpenseEditor(existing:JsonObject,options:JsonObject,saving:Boolean,error:String?,newCategoryId:String?,onClose:()->Unit,onSave:(JsonObject,Boolean)->Unit,addCategory:()->Unit){
 var addingItem by remember { mutableStateOf(false) }
 var taxSettingsOpen by remember { mutableStateOf(false) }
 var branch by remember{mutableStateOf(existing.str("branchId").ifBlank{options.array("branches").firstOrNull()?.jsonObject?.str("id").orEmpty()})};var category by remember{mutableStateOf(existing.str("categoryId"))};var account by remember{mutableStateOf(existing.str("moneyAccountId"))};var project by remember{mutableStateOf(existing.str("projectId"))};val allowed=(options["allowedTypes"] as? JsonArray)?.map{it.jsonPrimitive.content}.orEmpty();var type by remember{mutableStateOf(existing.str("type").ifBlank{allowed.firstOrNull()?:"OFFICE_EXPENSE"})};var amount by remember{mutableStateOf(existing.str("taxableAmount"))};var tax by remember{mutableStateOf(existing.str("taxRate").ifBlank{"0"})};var cess by remember{mutableStateOf(existing.str("cessRate").ifBlank{"0"})};var mode by remember{mutableStateOf(existing.str("taxMode").ifBlank{options.str("defaultTaxMode").ifBlank{"EXCLUSIVE"}})};var credit by remember{mutableStateOf(existing.str("taxCreditTreatment").ifBlank{"ELIGIBLE"})};var supply by remember{mutableStateOf(existing.str("stateOfSupplyCode"))};var gst by remember{mutableStateOf((tax.toDoubleOrNull()?:0.0)>0||(cess.toDoubleOrNull()?:0.0)>0)};var date by remember{mutableStateOf(existing.str("transactionDate").take(10).ifBlank{java.time.LocalDate.now().toString()})};var reference by remember{mutableStateOf(existing.str("reference"))};var notes by remember{mutableStateOf(existing.str("notes"))};var charges by remember{mutableStateOf(existing.str("additionalCharges").ifBlank{"0"})};var round by remember{mutableStateOf(existing["roundOffEnabled"]?.jsonPrimitive?.booleanOrNull==true)};var lines by remember{mutableStateOf(existing.array("billedItems").map{val l=it.jsonObject;ExpenseLine(l.str("name"),l.str("quantity"),l.str("rate"))})};var confirmClose by remember{mutableStateOf(false)}
 LaunchedEffect(newCategoryId){newCategoryId?.let{category=it}}
 val income=type=="OTHER_INCOME";val categories=options.array("categories").filter{val sc=it.jsonObject.str("scope");sc=="BOTH"||sc==(if(income)"INCOME"else "EXPENSE")};val accounts=options.array("moneyAccounts").filter{it.jsonObject.str("branchId").let{b->b.isBlank()||b==branch}};val projects=options.array("projects").filter{it.jsonObject.str("branchId")==branch};val preview=expensePreview(amount,lines,charges,if(gst&&!income)tax else "0",if(gst&&!income)cess else "0",mode,round,options["compositionEnabled"]?.jsonPrimitive?.booleanOrNull==true)
 fun save(saveNew:Boolean){onSave(buildJsonObject{put("recordAsPaid",!existing.containsKey("id")&&type!="REIMBURSEMENT");put("branchId",branch);put("categoryId",category);put("type",type);put("projectId",project);put("moneyAccountId",account);put("transactionDate",date);put("taxableAmount",if(lines.isEmpty())amount else "0");put("billedItems",JsonArray(lines.map{l->buildJsonObject{put("name",l.name);put("quantity",l.quantity);put("rate",l.rate)}}));put("additionalCharges",charges);put("roundOffEnabled",round);put("taxRate",if(gst&&!income)tax else "0");put("cessRate",if(gst&&!income)cess else "0");put("taxMode",mode);put("taxCreditTreatment",credit);put("stateOfSupplyCode",supply);put("reference",reference);put("notes",notes)},saveNew)}
 val canSave = !saving&&branch.isNotBlank()&&category.isNotBlank()&&preview!=null&&(type=="REIMBURSEMENT"||account.isNotBlank())&&(type!="PROJECT_EXPENSE"||project.isNotBlank())
 androidx.compose.ui.window.Dialog(onDismissRequest={if(!saving)confirmClose=true},properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false,decorFitsSystemWindows=false,dismissOnClickOutside=false)) {
  Surface(Modifier.fillMaxSize()) {
   Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
    Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically) {
     IconButton({confirmClose=true},enabled=!saving){Icon(Icons.Default.ArrowBack,"Back from expense")}
     Text(if(existing.containsKey("id"))"Edit Expense" else if(income)"Other Income" else "Expense",style=MaterialTheme.typography.titleLarge,modifier=Modifier.weight(1f))
     Text("GST",style=MaterialTheme.typography.labelMedium)
     Switch(gst&&!income,{gst=it;if(!it){tax="0";cess="0"}},enabled=!income&&!saving,modifier=Modifier.semantics{contentDescription="GST / tax"})
     IconButton({taxSettingsOpen=true},enabled=!income&&!saving){Icon(Icons.Default.Settings,"Open tax settings")}
    }
    HorizontalDivider()
    LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
 item{
  val series=options.array("numbering").firstOrNull{it.str("branchId")==branch}
  val number=if(existing.containsKey("id"))existing.str("transactionNumber")else if(series!=null)series.str("prefix")+series.str("nextSequence").padStart(series["padding"]?.jsonPrimitive?.intOrNull?:6,'0')+series.str("suffix")else (if(income)"OI-"else "EXP-")+"000001"
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically){
   Column(Modifier.weight(1f)){Text("Expense No.",style=MaterialTheme.typography.labelMedium);Text(number);if(!existing.containsKey("id"))Text("Number preview; assigned by server when saved.",style=MaterialTheme.typography.bodySmall)}
   OutlinedTextField(date,{date=it},readOnly=existing.str("occurrenceKey").isNotBlank(),enabled=!saving,label={Text("Date (YYYY-MM-DD)")},modifier=Modifier.weight(1f))
  }
 }
 item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){Text("Firm Name",style=MaterialTheme.typography.labelMedium);Text(options.str("companyName"),modifier=Modifier.weight(1f))};HorizontalDivider(Modifier.padding(top=12.dp))}
 item{SelectText("Transaction type",type,allowed){type=it;category="";project="";if(it=="OTHER_INCOME"){gst=false;tax="0";cess="0"}}}
 item{Select("Branch",branch,options.array("branches"),{branch=it;account="";project=""})}
 item{Select("Category",category,categories,{category=it})}
 if(options["canCreateCategory"]?.jsonPrimitive?.booleanOrNull==true)item{TextButton(addCategory,enabled=!saving){Text("Add expense / income category")}}
 item{Select("Cash / bank account",account,accounts,{account=it},if(type=="REIMBURSEMENT")"Reimbursement payable"else "Select account")}
 item{Select("Project",project,projects,{project=it},"No project")}
 item{Text("Billed items",fontWeight=FontWeight.Bold)}
 items(lines.size){i->val l=lines[i];val qty=l.quantity.toBigDecimalOrNull();val rate=l.rate.toBigDecimalOrNull();Column{
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)){
   OutlinedTextField(l.name,{v->lines=lines.mapIndexed{j,x->if(i==j)x.copy(name=v)else x}},label={Text("Name")},enabled=!saving,modifier=Modifier.weight(2f).semantics{contentDescription="Item ${i+1} name"})
   OutlinedTextField(l.quantity,{v->lines=lines.mapIndexed{j,x->if(i==j)x.copy(quantity=v)else x}},label={Text("Qty")},enabled=!saving,modifier=Modifier.weight(1f).semantics{contentDescription="Item ${i+1} quantity"})
   OutlinedTextField(l.rate,{v->lines=lines.mapIndexed{j,x->if(i==j)x.copy(rate=v)else x}},label={Text("Rate")},enabled=!saving,modifier=Modifier.weight(1.2f).semantics{contentDescription="Item ${i+1} rate"})
   Column(Modifier.weight(1.2f).padding(top=6.dp)){Text("Amount",style=MaterialTheme.typography.labelSmall);Text(if(qty!=null&&rate!=null)accountMoney(qty.multiply(rate))else "—",style=MaterialTheme.typography.bodySmall)}
  }
  TextButton({lines=lines.filterIndexed{j,_->j!=i}},enabled=!saving,modifier=Modifier.align(Alignment.End)){Text("Remove item ${i+1}")}
 }}
 item{TextButton({addingItem=true},enabled=!saving&&lines.size<200){Text("Add billed item")}}
 if(lines.isEmpty())item{OutlinedTextField(amount,{amount=it},label={Text("Entered amount")})}
 item{OutlinedTextField(charges,{charges=it},label={Text("Additional taxable charges")})}
 item{Row{Checkbox(round,{round=it});Text("Round Off")}}
 if(income)item{Text("Other Income is non-taxable. GST and CESS are zero.")}
 if(gst&&!income)item{TextButton({taxSettingsOpen=true},enabled=!saving){Text("Tax settings · GST $tax% · CESS $cess%")}}
 item{Text(preview?.let{"Taxable ${accountMoney(it.taxable)} · Tax ${accountMoney(it.tax)} · Round off ${accountMoney(it.rounding)} · Total ${accountMoney(it.total)}"}?:"Complete positive amounts to preview totals.")}
 item{OutlinedTextField(reference,{reference=it},label={Text("Reference")})};item{OutlinedTextField(notes,{notes=it},label={Text("Notes")})};error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}}
    }
    HorizontalDivider()
    Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
     if(!existing.containsKey("id"))OutlinedButton({save(true)},enabled=canSave,modifier=Modifier.weight(1f)){Text("Save & New")}
     Button({save(false)},enabled=canSave,modifier=Modifier.weight(1f)){Text(if(saving)"Saving…"else if(existing.containsKey("id")||type=="REIMBURSEMENT")"Save draft"else if(income)"Save receipt"else "Save")}
    }
   }
  }
 }

 if(taxSettingsOpen)AlertDialog(onDismissRequest={taxSettingsOpen=false},title={Text("Tax settings")},text={Column(Modifier.fillMaxWidth().heightIn(max=440.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
  if(!gst&&!income)TextButton({gst=true},enabled=!saving){Text("Enable GST for this expense")}
  OutlinedTextField(tax,{tax=it},enabled=gst&&!income&&!saving,label={Text("GST rate (%)")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(cess,{cess=it},enabled=gst&&!income&&!saving,label={Text("CESS rate (%)")},modifier=Modifier.fillMaxWidth())
  SelectText("Tax mode",mode,listOf("EXCLUSIVE","INCLUSIVE")){mode=it}
  SelectText("Input tax credit",credit,listOf("ELIGIBLE","INELIGIBLE","BLOCKED")){credit=it}
  OutlinedTextField(supply,{supply=it},enabled=!saving,label={Text("State of supply code")},modifier=Modifier.fillMaxWidth())
 }},confirmButton={TextButton({taxSettingsOpen=false}){Text("Done")}})
 if(addingItem)AddExpenseItemScreen(onClose={addingItem=false},onSave={name->if(lines.size<200)lines=lines+ExpenseLine(name,"1","0");addingItem=false})
 if(confirmClose)AlertDialog(onDismissRequest={confirmClose=false},title={Text("Discard unsaved changes?")},confirmButton={TextButton(onClose){Text("Discard")}},dismissButton={TextButton({confirmClose=false}){Text("Keep editing")}})
}
@OptIn(ExperimentalLayoutApi::class) @Composable private fun ExpenseDetail(x:JsonObject,saving:Boolean,error:String?,onClose:()->Unit,onEdit:(JsonObject)->Unit,onAction:(String,String,String?,String?,String?)->Unit,onAttach:(String,String,String,ByteArray)->Unit,onDownload:(String,String)->Unit,onRecurring:(JsonObject)->Unit,options:JsonObject,onPayRecurring:(String,JsonObject)->Unit){
 val context=LocalContext.current;val scope=rememberCoroutineScope();val id=x.str("id");val cap=x["capabilities"] as? JsonObject;fun can(k:String)=cap?.get(k)?.jsonPrimitive?.booleanOrNull==true
 var paying by remember{mutableStateOf(false)}
 var reject by remember{mutableStateOf(false)};var reverse by remember{mutableStateOf(false)};var schedule by remember{mutableStateOf(false)};var fileBusy by remember{mutableStateOf(false)};var fileError by remember{mutableStateOf<String?>(null)}
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()){uri->if(uri!=null&&!fileBusy){fileBusy=true;fileError=null;scope.launch{try{val(name,mime,bytes)=readExpenseAttachment(context,uri);onAttach(id,name,mime,bytes)}catch(e:Exception){fileError=e.message?:"Attachment could not be read."}finally{fileBusy=false}}}}
 fun related(k:String)= (x[k] as? JsonObject)?.str("name").orEmpty().ifBlank{"Not recorded"}
 fun person(userId:String)=x.array("people").map{it.jsonObject}.firstOrNull{it.str("id")==userId}?.str("name")?:"Historical user"
 AlertDialog(onDismissRequest={if(!saving)onClose()},title={Text(x.str("transactionNumber"))},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
 item{Text("${x.str("type").replace('_',' ')} · ${x.str("status")}",fontWeight=FontWeight.Bold)}
 item{Text("Date ${accountDate(x.str("transactionDate"))} · Branch ${related("branch")}")}
 if(x.str("paidDate").isNotBlank())item{Text("Payment date ${accountDate(x.str("paidDate"))}");Text("Approval review ${x.str("approvalReviewStatus").replace('_',' ')}");if(x.str("approvalReviewReason").isNotBlank())Text("Review reason ${x.str("approvalReviewReason")}")}
 item{Text("Category ${related("category")} · Project ${related("project")}")}
 item{Text("Cash / bank ${related("moneyAccount")}")}
 item{Text("Taxable ${accountMoney(x.str("taxableAmount"))} · Tax ${accountMoney(x.str("taxAmount"))}")}
 item{Text("CGST ${x.str("cgstAmount")} · SGST ${x.str("sgstAmount")} · IGST ${x.str("igstAmount")} · CESS ${x.str("cessAmount")}")}
 item{Text("${x.str("taxMode")} · ITC ${x.str("taxCreditTreatment")} · Supply ${x.str("stateOfSupplyCode")}")}
 items(x.array("billedItems")){l->val v=l.jsonObject;Text("${v.str("name")} · ${v.str("quantity")} × ${accountMoney(v.str("rate"))}")}
 item{Text("Charges ${accountMoney(x.str("additionalCharges"))} · Round off ${accountMoney(x.str("roundOffAmount"))}")}
 item{Text("Total ${accountMoney(x.str("totalAmount"))}",style=MaterialTheme.typography.titleLarge)}
 item{Text("Reference ${x.str("reference")}");Text("Notes ${x.str("notes")}");Text("Created by ${person(x.str("createdById"))}");if(x.str("approvedById").isNotBlank())Text("Approved by ${person(x.str("approvedById"))} · ${x.str("approvedAt")}")}
 error?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}};fileError?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error)}}
 if(can("payRecurring"))item{Button({paying=true},enabled=!saving){Text("Mark recurring bill paid")};Text("Payment posts on the actual payment date; due date stays unchanged.")}
 item{FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){if(can("edit"))Button({onEdit(x)},enabled=!saving){Text("Edit draft")};if(can("submit"))Button({onAction(id,"TRANSITION","PENDING_APPROVAL",null,null)},enabled=!saving){Text("Submit")};if(can("cancel"))OutlinedButton({onAction(id,"TRANSITION","CANCELLED",null,null)},enabled=!saving){Text("Cancel expense")};if(can("approve"))Button({onAction(id,"TRANSITION","APPROVED",null,null)},enabled=!saving){Text("Approve")};if(can("reject"))OutlinedButton({reject=true},enabled=!saving){Text("Reject")};if(can("post"))Button({onAction(id,"POST",null,null,null)},enabled=!saving){Text("Post")};if(can("reverse"))OutlinedButton({reverse=true},enabled=!saving){Text("Reverse")}}}
 if(can("attach"))item{OutlinedButton({picker.launch("*/*")},enabled=!saving&&!fileBusy){Text(if(fileBusy)"Reading attachment…"else "Attach PDF/image")}}
 items(x.array("attachments")){a->val o=a.jsonObject;TextButton({onDownload(o.str("id"),o.str("displayName"))},enabled=!saving){Text("Download / share ${o.str("displayName")}")}}
 items(x.array("history")){h->val o=h.jsonObject;val reason=(o["metadata"] as? JsonObject)?.str("reason").orEmpty();Text("${o.str("eventType").replace('_',' ')} · ${person(o.str("actorUserId"))} · ${o.str("createdAt")}${if(reason.isBlank())""else " · $reason"}",style=MaterialTheme.typography.bodySmall)}
 if(can("attach")&&x.str("type")in listOf("OFFICE_EXPENSE","PROJECT_EXPENSE"))item{OutlinedButton({schedule=true},enabled=!saving){Text("Create separate future expense schedule")};Text("Scheduling is separate from this saved transaction; it does not post another expense now.")}
 }},confirmButton={TextButton(onClose,enabled=!saving){Text("Close")}})
 if(paying&&can("payRecurring"))RecurringPaymentDialog(x,options,saving,error,{paying=false}){payload->onPayRecurring(id,payload)}
 if(reject)ReasonDialog("Reject expense",saving,error,false,{reject=false}){reason,_->onAction(id,"TRANSITION","REJECTED",reason,null)}
 if(reverse)ReasonDialog("Reverse posted expense",saving,error,true,{reverse=false}){reason,date->onAction(id,"REVERSE",null,reason,date)}
 if(schedule)ScheduleDialog(x,saving,error,{schedule=false},onRecurring)
 LaunchedEffect(x.str("status")){reject=false;reverse=false;paying=false}
}
@Composable private fun ReasonDialog(title:String,saving:Boolean,error:String?,withDate:Boolean,onClose:()->Unit,onConfirm:(String,String?)->Unit){var reason by remember{mutableStateOf("")};var date by remember{mutableStateOf(java.time.LocalDate.now().toString())};AlertDialog(onDismissRequest={if(!saving)onClose()},title={Text(title)},text={Column{OutlinedTextField(reason,{if(it.length<=500)reason=it},label={Text("Reason")});if(withDate)OutlinedTextField(date,{date=it},label={Text("Reversal date (YYYY-MM-DD)")});error?.let{Text(it,color=MaterialTheme.colorScheme.error)}}},confirmButton={Button(enabled=!saving&&reason.isNotBlank()&&(!withDate||runCatching{java.time.LocalDate.parse(date)}.isSuccess),onClick={onConfirm(reason,if(withDate)date else null)}){Text(if(saving)"Saving…"else "Confirm")}},dismissButton={TextButton(onClose,enabled=!saving){Text("Cancel")}})}
@Composable private fun ScheduleDialog(x:JsonObject,saving:Boolean,error:String?,close:()->Unit,save:(JsonObject)->Unit){val creationRequestKey=remember{java.util.UUID.randomUUID().toString()};var frequency by remember{mutableStateOf("MONTHLY")};var due by remember{mutableStateOf(java.time.LocalDate.now().plusMonths(1).toString())};var amount by remember{mutableStateOf(x.str("taxableAmount"))};AlertDialog(onDismissRequest={if(!saving)close()},title={Text("Separate future expense schedule")},text={Column{Text("Generate each due bill manually, then record its actual payment date and account. Approval reviews the payment. This schedule does not repeat Other Income or copy tax/payment details.");SelectText("Frequency",frequency,listOf("WEEKLY","MONTHLY","QUARTERLY","YEARLY")){frequency=it};OutlinedTextField(due,{due=it},label={Text("First due date (YYYY-MM-DD)")});OutlinedTextField(amount,{amount=it},label={Text("Future expense base amount")});error?.let{Text(it,color=MaterialTheme.colorScheme.error)}}},confirmButton={Button(enabled=!saving&&amount.toBigDecimalOrNull()?.let{it.signum()>0}==true&&runCatching{java.time.LocalDate.parse(due)}.isSuccess,onClick={save(buildJsonObject{put("branchId",x.str("branchId"));if(x.str("projectId").isNotBlank())put("projectId",x.str("projectId"));put("categoryId",x.str("categoryId"));put("frequency",frequency);put("nextDueDate",due);put("amount",amount);put("creationRequestKey",creationRequestKey)})}){Text(if(saving)"Saving…"else "Save schedule")}},dismissButton={TextButton(close,enabled=!saving){Text("Close")}})}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun Select(label:String,value:String,values:List<JsonElement>,onValue:(String)->Unit,empty:String="Select"){var open by remember{mutableStateOf(false)};val selected=values.map{it.jsonObject}.firstOrNull{it.str("id")==value};ExposedDropdownMenuBox(open,{open=it}){OutlinedTextField(selected?.str("name").orEmpty(),{},readOnly=true,label={Text(label)},trailingIcon={ExposedDropdownMenuDefaults.TrailingIcon(open)},modifier=Modifier.menuAnchor());ExposedDropdownMenu(open,{open=false}){DropdownMenuItem({Text(empty)},{onValue("");open=false});values.forEach{e->val o=e.jsonObject;DropdownMenuItem({Text(o.str("name"))},{onValue(o.str("id"));open=false})}}}}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun SelectText(label:String,value:String,values:List<String>,onValue:(String)->Unit){var open by remember{mutableStateOf(false)};ExposedDropdownMenuBox(open,{open=it}){OutlinedTextField(value.replace('_',' '),{},readOnly=true,label={Text(label)},modifier=Modifier.menuAnchor());ExposedDropdownMenu(open,{open=false}){values.forEach{v->DropdownMenuItem({Text(v.replace('_',' '))},{onValue(v);open=false})}}}}

@Composable private fun RecurringSchedulesDialog(s:ExpenseState,close:()->Unit,action:(String,JsonObject)->Unit,onBills:(String,String)->Unit){
 var editing by remember{mutableStateOf<JsonObject?>(null)}
 LaunchedEffect(s.recurringRows){editing?.let{old->val current=s.recurringRows.firstOrNull{it.str("id")==old.str("id")};if(current!=null&&current.str("updatedAt")!=old.str("updatedAt"))editing=null}}
 var accounts by remember{mutableStateOf<Map<String,String>>(emptyMap())}
 AlertDialog(onDismissRequest={if(!s.saving)close()},title={Text("Recurring expenses")},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(12.dp)){
 item{Text("Generate due bills manually, then open each bill to record its actual payment. Pausing keeps previous bills.");if(s.loading)LinearProgressIndicator();s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)};if(!s.loading&&s.recurringRows.isEmpty())Text("No recurring schedules yet. Open a saved expense to create one.")}
 items(s.recurringRows,key={it.str("id")}){row->val id=row.str("id");val active=row["isActive"]?.jsonPrimitive?.booleanOrNull==true;val due=row.str("nextDueDate").take(10);val today=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString();val category=s.options.array("categories").firstOrNull{it.str("id")==row.str("categoryId")};Card{Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
 Text(category?.str("name")?:"Expense schedule",fontWeight=FontWeight.Bold);Text("${row.str("frequency")} · ${accountMoney(row.str("amount"))}");Text("Next due: $due · ${if(active)"Active"else"Paused"}${if(!active)""else if(due<today)" · Overdue"else if(due==today)" · Due today"else " · Upcoming"}");if(s.options["canCreateExpense"]?.jsonPrimitive?.booleanOrNull==true)OutlinedButton(enabled=!s.saving,onClick={action(id,buildJsonObject{put("action","ACTIVE");put("isActive",!active)})}){Text(if(active)"Pause schedule"else"Resume schedule")}
 if(s.options["canCreateExpense"]?.jsonPrimitive?.booleanOrNull==true)OutlinedButton({editing=row},enabled=!s.saving){Text("Edit future schedule")}
 TextButton({onBills(id,row.str("branchId"))},enabled=!s.saving){Text("View all bills for this schedule")}
 if(active&&s.options["canCreateExpense"]?.jsonPrimitive?.booleanOrNull==true){val eligible=s.options.array("moneyAccounts").map{it.jsonObject}.filter{it.str("branchId").isBlank()||it.str("branchId")==row.str("branchId")};Select("Payment account",accounts[id].orEmpty(),eligible,onValue={accounts=accounts+(id to it)});Button(enabled=!s.saving&&due<=today&&!accounts[id].isNullOrBlank(),onClick={action(id,buildJsonObject{put("action","GENERATE");put("moneyAccountId",accounts[id].orEmpty());put("expectedDueDate",due)})}){Text(if(s.saving)"Saving…"else"Generate due bill")}}
 }}}
 }},confirmButton={TextButton(close,enabled=!s.saving){Text("Close")}})
 editing?.let{row->RecurringScheduleEditDialog(row,s.saving,s.error,{editing=null}){payload->action(row.str("id"),payload)}}
}

@Composable private fun RecurringPaymentDialog(x:JsonObject,options:JsonObject,saving:Boolean,error:String?,close:()->Unit,pay:(JsonObject)->Unit){
 val requestKey=remember{java.util.UUID.randomUUID().toString()}
 var date by remember{mutableStateOf(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString())}
 var account by remember{mutableStateOf(x.str("moneyAccountId"))}
 val accounts=options.array("moneyAccounts").filter{it.str("branchId").isBlank()||it.str("branchId")==x.str("branchId")}
 AlertDialog(onDismissRequest={if(!saving)close()},title={Text("Record recurring payment")},text={Column{
  Text("Due date ${accountDate(x.str("transactionDate"))} stays unchanged.")
  OutlinedTextField(date,{date=it},label={Text("Payment date (YYYY-MM-DD)")},enabled=!saving)
  Select("Paid from",account,accounts,{account=it})
  error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 }},confirmButton={Button(enabled=!saving&&account.isNotBlank()&&runCatching{java.time.LocalDate.parse(date)}.isSuccess,onClick={pay(buildJsonObject{put("requestKey",requestKey);put("paymentDate",date);put("moneyAccountId",account)})}){Text(if(saving)"Saving…"else "Record payment")}},dismissButton={TextButton(close,enabled=!saving){Text("Cancel")}})
}

@Composable private fun RecurringScheduleEditDialog(row:JsonObject,saving:Boolean,error:String?,close:()->Unit,save:(JsonObject)->Unit){
 var frequency by remember{mutableStateOf(row.str("frequency"))}
 var amount by remember{mutableStateOf(row.str("amount"))}
 var due by remember{mutableStateOf(row.str("nextDueDate").take(10))}
 AlertDialog(onDismissRequest={if(!saving)close()},title={Text("Edit future schedule")},text={Column{
  SelectText("Frequency",frequency,listOf("WEEKLY","MONTHLY","QUARTERLY","YEARLY")){if(!saving)frequency=it}
  OutlinedTextField(due,{due=it},enabled=!saving,label={Text("Next due date (YYYY-MM-DD)")})
  OutlinedTextField(amount,{amount=it},enabled=!saving,label={Text("Future bill amount")})
  Text("Existing bills and recorded payments stay unchanged.")
  error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 }},confirmButton={Button(enabled=!saving&&amount.toBigDecimalOrNull()?.signum()==1&&runCatching{java.time.LocalDate.parse(due)}.isSuccess,onClick={save(buildJsonObject{put("action","EDIT");put("frequency",frequency);put("amount",amount);put("nextDueDate",due);put("expectedUpdatedAt",row.str("updatedAt"))})}){Text(if(saving)"Saving…"else"Save changes")}},dismissButton={TextButton(close,enabled=!saving){Text("Cancel")}})
}
