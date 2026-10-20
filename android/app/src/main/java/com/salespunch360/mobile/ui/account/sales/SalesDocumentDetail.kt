package com.salespunch360.mobile.ui.account.sales

import com.salespunch360.mobile.ui.account.accountMoney
import com.salespunch360.mobile.ui.account.accountDate
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import android.net.Uri
import android.content.Intent
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.data.safeAttachmentFile
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.salespunch360.mobile.account.bool
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesDocumentDetail(doc:JsonObject,saving:Boolean,onClose:()->Unit,onPost:(String)->Unit,onEdit:()->Unit,onDelete:()->Unit){
    val isSale=doc.str("type")=="SALES_INVOICE"
    var preview by remember(doc.str("id")){mutableStateOf(doc.bool("previewOnOpen"))}
    if(preview){InvoicePdfPreview(doc.str("id")){preview=false};return}
    val status=doc.str("status")
    val base=doc.str("payableAmount").ifBlank{doc.str("grandTotal")}
    val totals=com.salespunch360.mobile.account.saleDetailTotals(doc)
    val outstanding=totals.outstanding
    val editable=isSale&&totals.canChange
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    var sharing by remember{mutableStateOf(false)}
    var shareError by remember{mutableStateOf<String?>(null)}
    var menuOpen by remember{mutableStateOf(false)}
    var shareChoice by remember{mutableStateOf(false)}
    fun sharePdf(){if(sharing)return;sharing=true;shareError=null;scope.launch{try{
        val bytes=ApiClient(SecureSession(context)).accountDocumentPdf(doc.str("type"),doc.str("id"))
        val file=withContext(Dispatchers.IO){safeAttachmentFile(context.cacheDir,"invoice-${doc.str("id")}.pdf").also{it.writeBytes(bytes)}}
        val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share invoice"))
    }catch(_:Exception){shareError="Invoice could not be shared. Try again."}finally{sharing=false}}}
    val invoiceAmount=accountMoney(doc.str("grandTotal"))
    fun shareInvoice(){if(doc.str("shareAs")=="PDF")sharePdf() else shareChoice=true}
    if(shareChoice)AlertDialog(onDismissRequest={shareChoice=false},title={Text("Share invoice")},confirmButton={TextButton({shareChoice=false;sharePdf()}){Text("PDF")}},dismissButton={TextButton({shareChoice=false;try{context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,"Invoice ${doc.str("documentNumber")} for ${doc.str("partyName")} — $invoiceAmount"),"Share invoice summary"))}catch(_:Exception){shareError="No sharing app is available."}}){Text("Invoice summary")}})
    var confirmDelete by remember{mutableStateOf(false)}
    if(!isSale){AlertDialog(onDismissRequest=onClose,title={Text(doc.str("documentNumber").ifBlank{"Sales document"})},confirmButton={if(status=="DRAFT"&&doc.str("type") in listOf("CREDIT_NOTE"))Button(enabled=!saving,onClick={onPost(doc.str("id"))}){Text("Post")}},dismissButton={TextButton(onClose){Text("Close")}},text={Text("${doc.str("type").replace('_',' ')} · $status\n${doc.str("partyName")}")});return}
    Scaffold(
        topBar={TopAppBar(title={Text("Sale",fontSize=25.sp,fontWeight=FontWeight.Medium)},navigationIcon={IconButton(onClick=onClose){Icon(Icons.Default.ArrowBack,"Back")}},actions={IconButton(enabled=!sharing,onClick={shareInvoice()}){Icon(Icons.Default.Share,"Share")};Box{IconButton(onClick={menuOpen=true}){Icon(Icons.Default.MoreVert,"More")};DropdownMenu(expanded=menuOpen,onDismissRequest={menuOpen=false}){DropdownMenuItem(text={Text("Preview invoice")},onClick={menuOpen=false;preview=true});DropdownMenuItem(text={Text("Share invoice")},enabled=!sharing,onClick={menuOpen=false;shareInvoice()});DropdownMenuItem(text={Text("Edit")},enabled=editable&&!saving,onClick={menuOpen=false;onEdit()});DropdownMenuItem(text={Text("Delete")},enabled=editable&&!saving,onClick={menuOpen=false;confirmDelete=true})}}})},
        bottomBar={Row(Modifier.fillMaxWidth().height(64.dp).background(Color.White)){TextButton(onClick={confirmDelete=true},enabled=editable&&!saving,modifier=Modifier.weight(1f).fillMaxHeight()){Text("Delete",fontSize=18.sp,color=Color.DarkGray)};Button(onClick=onEdit,enabled=editable&&!saving,shape=RoundedCornerShape(0.dp),modifier=Modifier.weight(1f).fillMaxHeight()){Text("Edit",fontSize=18.sp)}}}
    ){pad->LazyColumn(Modifier.fillMaxSize().padding(pad),contentPadding=PaddingValues(bottom=18.dp)){
        itemsIndexed(doc.array("preparedMessages")){_,prepared->Column(Modifier.padding(18.dp)){Text(prepared.str("label"),fontWeight=FontWeight.Bold);Text(prepared.str("message"));Row{TextButton(onClick={try{context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,prepared.str("message")),"Send message"))}catch(_:Exception){shareError="No sharing app is available."}}){Text("Share message")};if(prepared.str("phone").isNotBlank())TextButton(onClick={try{val phone=prepared.str("phone").filter{it.isDigit()||it=='+'};context.startActivity(Intent(Intent.ACTION_SENDTO,Uri.parse("smsto:$phone")).putExtra("sms_body",prepared.str("message")))}catch(_:Exception){shareError="No SMS app is available. Use Share message."}}){Text("Open SMS")}}}}
        item{if(sharing)LinearProgressIndicator(Modifier.fillMaxWidth());shareError?.let{Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.padding(16.dp))}}
        item{Row(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=12.dp)){Column(Modifier.weight(1f)){Text("Invoice No.",color=Color(0xFF626970));Text(doc.str("documentNumber"),fontSize=17.sp)};Column(Modifier.weight(1f)){Text("Date",color=Color(0xFF626970));Text(accountDate(doc.str("issueDate")),fontSize=17.sp)}};HorizontalDivider();Text("Firm Name: ${doc["branch"]?.jsonObject?.str("name").orEmpty()}",Modifier.padding(20.dp,14.dp),fontSize=17.sp);HorizontalDivider(thickness=14.dp,color=Color(0xFFF5F5F5));Column(Modifier.padding(18.dp)){Text("Party Balance: ${doc.str("partyBalance").takeIf{it.isNotBlank()}?.let{accountMoney(it)} ?: "Not available"}",Modifier.align(Alignment.End),color=Color(0xFF626970));OutlinedCard(Modifier.fillMaxWidth().padding(top=8.dp)){Column(Modifier.padding(14.dp)){Text("Customer Name *",color=Color(0xFF626970),fontSize=13.sp);Text(doc.str("partyName"),fontSize=20.sp)}};OutlinedCard(Modifier.fillMaxWidth().padding(top=14.dp)){Column(Modifier.padding(14.dp)){Text("Billing Name (Optional)",color=Color(0xFF626970),fontSize=13.sp);Text(doc.str("billingName").ifBlank{doc.str("partyName")},fontSize=20.sp)}};Surface(Modifier.fillMaxWidth().padding(top=18.dp),shape=RoundedCornerShape(7.dp),color=Color(0xFF8FC7F2)){Row(Modifier.padding(14.dp,11.dp),horizontalArrangement=Arrangement.SpaceBetween){Text("⌄  Billed Items",color=Color.White,fontWeight=FontWeight.SemiBold);Text(if(doc.str("taxMode")=="INCLUSIVE")"Rate incl. tax⌄"else"Rate excl. tax⌄",color=Color.White)}}}}
        itemsIndexed(doc.array("lines")){index,line->Card(Modifier.fillMaxWidth().padding(horizontal=18.dp,vertical=5.dp),colors=CardDefaults.cardColors(containerColor=Color(0xFFF7F7F7))){Column(Modifier.padding(14.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Text("#${index+1}");Text(line.str("itemName"),fontWeight=FontWeight.Bold,fontSize=17.sp)};Text(accountMoney(line.str("lineTotal")),fontWeight=FontWeight.Bold,fontSize=17.sp)};Spacer(Modifier.height(9.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Item Subtotal",color=Color(0xFF626970));Text("${line.str("quantity")} × ${accountMoney(line.str("rate"))} = ${accountMoney(line.str("baseAmount"))}",color=Color(0xFF626970))};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Discount",color=Color(0xFFE4A927));Text(accountMoney(line.str("discountAmount")),color=Color(0xFFE4A927))};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Tax GST@${line.str("taxRate")}%",color=Color(0xFF626970));Text(accountMoney(line.str("taxAmount")),color=Color(0xFF626970))}}}}
        if(doc.str("shippingAddress").isNotBlank())item{Column(Modifier.fillMaxWidth().padding(18.dp)){Text("Shipping Address",color=Color(0xFF626970));Text(doc.str("shippingAddress"))}}
        if(doc.str("stateOfSupplyCode").isNotBlank())item{Column(Modifier.padding(18.dp)){Text("State of Supply",color=Color(0xFF626970));Text(doc.str("stateOfSupplyName").ifBlank{doc.str("stateOfSupplyCode")})}}
        item{Column(Modifier.fillMaxWidth().padding(top=14.dp).background(Color(0xFFF5F5F5)).padding(top=14.dp).background(Color.White).padding(18.dp)){Text("Charges",fontSize=20.sp);HorizontalDivider(Modifier.padding(vertical=16.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("☑ Round Off",fontSize=18.sp);Text(accountMoney(doc.str("roundOffAmount")),fontSize=18.sp)}};Column(Modifier.fillMaxWidth().padding(top=14.dp).background(Color(0xFFF5F5F5)).padding(top=14.dp).background(Color.White).padding(18.dp)){Total("Total Amount",base,true);if(doc.bool("reverseCharge"))Total("GST payable by recipient (reverse charge)",doc.str("taxTotal"));Total("Received",totals.received);if(totals.discount.toBigDecimalOrNull()?.signum()!=0)Total("Payment discount",totals.discount);if(totals.advance.toBigDecimalOrNull()?.signum()!=0)Total("Advance applied",totals.advance);if(totals.credits.toBigDecimalOrNull()?.signum()!=0)Total("Credit adjustments",totals.credits);Total("Balance Due",outstanding,true);if(totals.lifecycle!="POSTED")Text("Invoice status: ${totals.lifecycle}. Original amounts are retained.");if(!editable)Text("This posted Sale has payment or adjustment history. Use its correction workflow to retain that history.",Modifier.padding(top=10.dp),color=Color(0xFF8A5B00),fontSize=12.sp)}}
    }}
    if(confirmDelete)AlertDialog(onDismissRequest={confirmDelete=false},title={Text("Delete Sale?")},text={Text("SalesPunch will reverse this Sale with a Credit Note. Actual payments remain as customer advance credit; the original payment discount is removed.")},confirmButton={Button(onClick={confirmDelete=false;onDelete()},enabled=!saving){Text("Delete")}},dismissButton={TextButton(onClick={confirmDelete=false}){Text("Cancel")}})
}
@Composable private fun Total(label:String,value:String,strong:Boolean=false){Row(Modifier.fillMaxWidth().padding(vertical=5.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(label,fontSize=if(strong)19.sp else 16.sp,fontWeight=if(strong)FontWeight.Bold else null);Text(accountMoney(value),fontSize=if(strong)19.sp else 16.sp,fontWeight=if(strong)FontWeight.Bold else null)}}
