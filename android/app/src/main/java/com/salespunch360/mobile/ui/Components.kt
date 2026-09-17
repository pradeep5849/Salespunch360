package com.salespunch360.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable fun LoadingScreen(label:String="Loading…"){Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){CircularProgressIndicator();Spacer(Modifier.height(16.dp));Text(label)}}}
@Composable fun RetryScreen(message:String,retry:()->Unit,signOut:(()->Unit)?=null){Box(Modifier.fillMaxSize().padding(28.dp),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){Text("Connection needed",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Spacer(Modifier.height(8.dp));Text(message);Spacer(Modifier.height(24.dp));Button(retry,Modifier.fillMaxWidth()){Text("Try again")};signOut?.let{TextButton(it){Text("Sign out")}}}}}
@Composable fun MessageBanner(message:String,onDismiss:()->Unit){Surface(Modifier.fillMaxWidth(),color=MaterialTheme.colorScheme.errorContainer){Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically){Text(message,Modifier.weight(1f),color=MaterialTheme.colorScheme.onErrorContainer);TextButton(onDismiss){Text("Dismiss")}}}}

@Composable
fun ContentCard(title:String,body:String,content:(@Composable ColumnScope.()->Unit)?=null){
    Card(
        Modifier.fillMaxWidth().shadow(2.dp, RoundedCornerShape(16.dp)),
        shape=RoundedCornerShape(16.dp),
        colors=CardDefaults.cardColors(containerColor=Color.White),
        border=BorderStroke(1.dp, SalesLine),
    ){
        Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
            Text(title,fontWeight=FontWeight.Bold,color=SalesInk)
            Text(body,style=MaterialTheme.typography.bodyMedium,color=SalesMuted)
            content?.invoke(this)
        }
    }
}

@Composable
fun StatusChip(label:String){
    Surface(color=Color(0xFFEEF3FF),shape=RoundedCornerShape(999.dp)){
        Text(label,Modifier.padding(horizontal=10.dp,vertical=6.dp),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=SalesBlue)
    }
}

@Composable
fun CompanyIdentity(name:String,address:String?=null){
    Row(verticalAlignment=Alignment.CenterVertically){
        Surface(shape=RoundedCornerShape(13.dp),color=SalesNavy){
            Box(Modifier.size(44.dp),contentAlignment=Alignment.Center){Text(initials(name),fontWeight=FontWeight.ExtraBold,color=Color.White)}
        }
        Spacer(Modifier.width(10.dp))
        Column{
            Text(name,fontWeight=FontWeight.Bold,maxLines=1,color=SalesInk)
            address?.let{Text(it,style=MaterialTheme.typography.labelSmall,maxLines=1,color=SalesMuted)}
        }
    }
}
private fun initials(name:String)=name.trim().split(Regex("\\s+")).filter{it.isNotEmpty()}.take(2).mapNotNull{it.firstOrNull()?.uppercase()}.joinToString("").ifBlank{"CO"}
