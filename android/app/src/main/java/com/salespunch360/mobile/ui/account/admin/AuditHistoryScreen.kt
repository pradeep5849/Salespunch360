package com.salespunch360.mobile.ui.account.admin
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
@Composable fun AuditHistoryScreen(padding:PaddingValues){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))}
 var rows by remember{mutableStateOf<List<AccountAuditRow>>(emptyList())};var cursor by remember{mutableStateOf<String?>(null)};var next by remember{mutableStateOf<String?>(null)}
 var from by remember{mutableStateOf("")};var to by remember{mutableStateOf("")};var event by remember{mutableStateOf("")};var entity by remember{mutableStateOf("")};var actor by remember{mutableStateOf("")}
 var query by remember{mutableStateOf("")};var loading by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)};var retry by remember{mutableStateOf(0)}
 LaunchedEffect(query,cursor,retry){loading=true;error=null;try{val uri=Uri.Builder().encodedQuery(query);cursor?.let{uri.appendQueryParameter("cursor",it)};val page=api.accountAuditHistory(uri.build().encodedQuery.orEmpty());rows=if(cursor==null)page.rows else (rows+page.rows).distinctBy{it.id};next=page.nextCursor}catch(e:Exception){error=(e as? ApiException)?.serverMessage?:"Could not load authorized audit history."}finally{loading=false}}
 LazyColumn(Modifier.fillMaxSize().padding(padding),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  item{Text("Audit history",style=MaterialTheme.typography.headlineSmall);Text("Company-wide activity for all-branch Account Admins. Dates use India time.")}
  item{OutlinedTextField(from,{from=it},label={Text("From · YYYY-MM-DD")},modifier=Modifier.fillMaxWidth());OutlinedTextField(to,{to=it},label={Text("Through · YYYY-MM-DD")},modifier=Modifier.fillMaxWidth());OutlinedTextField(event,{event=it},label={Text("Event type")},modifier=Modifier.fillMaxWidth());OutlinedTextField(entity,{entity=it},label={Text("Entity type")},modifier=Modifier.fillMaxWidth());OutlinedTextField(actor,{actor=it},label={Text("Actor ID")},modifier=Modifier.fillMaxWidth());Button(enabled=!loading,onClick={val uri=Uri.Builder();listOf("from" to from,"to" to to,"eventType" to event,"entityType" to entity,"actorId" to actor).forEach{(k,v)->if(v.isNotBlank())uri.appendQueryParameter(k,v.trim())};rows=emptyList();cursor=null;query=uri.build().encodedQuery.orEmpty();retry++}){Text("Filter history")}}
  if(loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
  error?.let{message->item{Text(message,color=MaterialTheme.colorScheme.error);TextButton(onClick={retry++},enabled=!loading){Text("Retry")}}}
  if(!loading&&error==null&&rows.isEmpty())item{Text("No matching audit events.")}
  items(rows,key={it.id}){row->OutlinedCard(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){Text(row.eventType.replace('_',' '),style=MaterialTheme.typography.titleMedium);Text(row.actor.name);val time=runCatching{Instant.parse(row.createdAt).atZone(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"))}.getOrDefault(row.createdAt);Text("$time IST");Text(row.entityType.replace('_',' '));Text(row.entityId,style=MaterialTheme.typography.bodySmall)}}}
  next?.let{value->item{OutlinedButton(onClick={cursor=value},enabled=!loading,modifier=Modifier.fillMaxWidth()){Text("Load older events")}}}
 }
}
