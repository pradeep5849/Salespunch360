package com.salespunch360.mobile.ui.account.sales

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesDocumentDetail(doc:JsonObject,saving:Boolean,onClose:()->Unit,onPost:(String)->Unit,onEdit:()->Unit,onDelete:()->Unit){
    val isSale=doc.str("type")=="SALES_INVOICE"
    val status=doc.str("status")
    val base=doc.str("payableAmount").ifBlank{doc.str("grandTotal")}
    val outstanding=doc["financial"]?.jsonObject?.str("outstanding").orEmpty().ifBlank{base}
    val editable=isSale&&status=="POSTED"&&outstanding==base&&doc.array("adjustments").isEmpty()&&doc.array("allocations").isEmpty()&&doc.array("advanceApplications").isEmpty()
    var confirmDelete by remember{mutableStateOf(false)}
    if(!isSale){AlertDialog(onDismissRequest=onClose,title={Text(doc.str("documentNumber").ifBlank{"Sales document"})},confirmButton={if(status=="DRAFT"&&doc.str("type") in listOf("CREDIT_NOTE"))Button(enabled=!saving,onClick={onPost(doc.str("id"))}){Text("Post")}},dismissButton={TextButton(onClose){Text("Close")}},text={Text("${doc.str("type").replace('_',' ')} · $status\n${doc.str("partyName")}")});return}
    Scaffold(
        topBar={TopAppBar(title={Text("Sale",fontSize=25.sp,fontWeight=FontWeight.Medium)},navigationIcon={IconButton(onClick=onClose){Icon(Icons.Default.ArrowBack,"Back")}},actions={IconButton(onClick={}){Icon(Icons.Default.Share,"Share")};IconButton(onClick={}){Icon(Icons.Default.MoreVert,"More")}})},
        bottomBar={Row(Modifier.fillMaxWidth().height(64.dp).background(Color.White)){TextButton(onClick={confirmDelete=true},enabled=editable&&!saving,modifier=Modifier.weight(1f).fillMaxHeight()){Text("Delete",fontSize=18.sp,color=Color.DarkGray)};Button(onClick=onEdit,enabled=editable&&!saving,shape=RoundedCornerShape(0.dp),modifier=Modifier.weight(1f).fillMaxHeight()){Text("Edit",fontSize=18.sp)}}}
    ){pad->LazyColumn(Modifier.fillMaxSize().padding(pad),contentPadding=PaddingValues(bottom=18.dp)){
        item{Row(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=12.dp)){Column(Modifier.weight(1f)){Text("Invoice No.",color=Color.Gray);Text(doc.str("documentNumber"),fontSize=17.sp)};Column(Modifier.weight(1f)){Text("Date",color=Color.Gray);Text(doc.str("issueDate").take(10),fontSize=17.sp)}};HorizontalDivider();Text("Firm Name: ${doc["branch"]?.jsonObject?.str("name").orEmpty()}",Modifier.padding(20.dp,14.dp),fontSize=17.sp);HorizontalDivider(thickness=14.dp,color=Color(0xFFF5F5F5));Column(Modifier.padding(18.dp)){Text("Party Balance: ₹$outstanding",Modifier.align(Alignment.End),color=Color.Gray);OutlinedCard(Modifier.fillMaxWidth().padding(top=8.dp)){Column(Modifier.padding(14.dp)){Text("Customer Name *",color=Color.Gray,fontSize=13.sp);Text(doc.str("partyName"),fontSize=20.sp)}};OutlinedCard(Modifier.fillMaxWidth().padding(top=14.dp)){Column(Modifier.padding(14.dp)){Text("Billing Name (Optional)",color=Color.Gray,fontSize=13.sp);Text(doc.str("partyName"),fontSize=20.sp)}};Surface(Modifier.fillMaxWidth().padding(top=18.dp),shape=RoundedCornerShape(7.dp),color=Color(0xFF8FC7F2)){Row(Modifier.padding(14.dp,11.dp),horizontalArrangement=Arrangement.SpaceBetween){Text("⌄  Billed Items",color=Color.White,fontWeight=FontWeight.SemiBold);Text("Rate excl. tax⌄",color=Color.White)}}}}
        itemsIndexed(doc.array("lines")){index,line->Card(Modifier.fillMaxWidth().padding(horizontal=18.dp,vertical=5.dp),colors=CardDefaults.cardColors(containerColor=Color(0xFFF7F7F7))){Column(Modifier.padding(14.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Text("#${index+1}");Text(line.str("itemName"),fontWeight=FontWeight.Bold,fontSize=17.sp)};Text("₹${line.str("lineTotal")}",fontWeight=FontWeight.Bold,fontSize=17.sp)};Spacer(Modifier.height(9.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Item Subtotal",color=Color.Gray);Text("${line.str("quantity")} × ${line.str("rate")} = ₹${line.str("baseAmount")}",color=Color.Gray)};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Discount",color=Color(0xFFE4A927));Text("₹${line.str("discountAmount")}",color=Color(0xFFE4A927))};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Tax GST@${line.str("taxRate")}%",color=Color.Gray);Text("₹${line.str("taxAmount")}",color=Color.Gray)}}}}
        item{Column(Modifier.fillMaxWidth().padding(top=14.dp).background(Color(0xFFF5F5F5)).padding(top=14.dp).background(Color.White).padding(18.dp)){Text("Charges",fontSize=20.sp);HorizontalDivider(Modifier.padding(vertical=16.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("☑ Round Off",fontSize=18.sp);Text("₹ ${doc.str("roundOffAmount")}",fontSize=18.sp)}};Column(Modifier.fillMaxWidth().padding(top=14.dp).background(Color(0xFFF5F5F5)).padding(top=14.dp).background(Color.White).padding(18.dp)){Total("Total Amount",doc.str("grandTotal"),true);val received=(base.toDoubleOrNull()?:0.0)-(outstanding.toDoubleOrNull()?:0.0);Total("Received",String.format("%.2f",received));Total("Balance Due",outstanding,true);if(!editable)Text("This Sale has a payment, advance or adjustment. Reverse those first before Edit/Delete.",Modifier.padding(top=10.dp),color=Color(0xFF8A5B00),fontSize=12.sp)}}
    }}
    if(confirmDelete)AlertDialog(onDismissRequest={confirmDelete=false},title={Text("Delete Sale?")},text={Text("SalesPunch will reverse this Sale with a Credit Note so stock and accounts remain correct.")},confirmButton={Button(onClick={confirmDelete=false;onDelete()},enabled=!saving){Text("Delete")}},dismissButton={TextButton(onClick={confirmDelete=false}){Text("Cancel")}})
}
@Composable private fun Total(label:String,value:String,strong:Boolean=false){Row(Modifier.fillMaxWidth().padding(vertical=5.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(label,fontSize=if(strong)19.sp else 16.sp,fontWeight=if(strong)FontWeight.Bold else null);Text("₹$value",fontSize=if(strong)19.sp else 16.sp,fontWeight=if(strong)FontWeight.Bold else null)}}
