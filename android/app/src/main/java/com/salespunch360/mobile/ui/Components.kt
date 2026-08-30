package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable fun LoadingScreen(label:String="Loading…"){Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){CircularProgressIndicator();Spacer(Modifier.height(16.dp));Text(label)}}}
@Composable fun RetryScreen(message:String,retry:()->Unit,signOut:()->Unit){Box(Modifier.fillMaxSize().padding(28.dp),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){Text("Connection needed",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Spacer(Modifier.height(8.dp));Text(message);Spacer(Modifier.height(24.dp));Button(retry,Modifier.fillMaxWidth()){Text("Try again")};TextButton(signOut){Text("Sign out")}}}}
@Composable fun MessageBanner(message:String,onDismiss:()->Unit){Surface(Modifier.fillMaxWidth(),color=MaterialTheme.colorScheme.errorContainer,shape=MaterialTheme.shapes.medium){Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically){Text(message,Modifier.weight(1f),color=MaterialTheme.colorScheme.onErrorContainer);TextButton(onDismiss){Text("Dismiss")}}}}
@Composable fun ContentCard(title:String,body:String,content:(@Composable ColumnScope.()->Unit)?=null){Card(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text(title,fontWeight=FontWeight.SemiBold);Text(body,style=MaterialTheme.typography.bodyMedium);content?.invoke(this)}}}
@Composable fun StatusChip(label:String){Surface(color=MaterialTheme.colorScheme.surfaceVariant,shape=MaterialTheme.shapes.extraLarge){Text(label,Modifier.padding(horizontal=12.dp,vertical=6.dp),style=MaterialTheme.typography.labelMedium)}}
@Composable fun CompanyIdentity(name:String){Row(verticalAlignment=Alignment.CenterVertically){Surface(shape=MaterialTheme.shapes.medium,color=MaterialTheme.colorScheme.primaryContainer){Box(Modifier.size(40.dp),contentAlignment=Alignment.Center){Text(initials(name),fontWeight=FontWeight.Bold)}};Spacer(Modifier.width(10.dp));Text(name,fontWeight=FontWeight.SemiBold)}}
private fun initials(name:String)=name.trim().split(Regex("\\s+")).filter{it.isNotEmpty()}.take(2).mapNotNull{it.firstOrNull()?.uppercase()}.joinToString("").ifBlank{"CO"}
