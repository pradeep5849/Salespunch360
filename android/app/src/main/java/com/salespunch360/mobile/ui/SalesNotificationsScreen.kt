package com.salespunch360.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.SalesNotificationsState
import com.salespunch360.mobile.data.SalesNotification
@Composable fun SalesNotificationsScreen(state:SalesNotificationsState,refresh:()->Unit,read:(String?)->Unit,open:(SalesNotification)->Unit){LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column{Text("Notifications",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Text("${state.data.unreadCount} unread",color=SalesMuted)};if(state.data.unreadCount>0)TextButton({read(null)}){Text("Mark all read")}}};if(state.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())};state.error?.let{item{Text(it,color=MaterialTheme.colorScheme.error);TextButton(refresh){Text("Try again")}}};if(!state.loading&&state.error==null&&state.data.items.isEmpty())item{ContentCard("You’re all caught up","No Sales notifications yet.") {}};items(state.data.items,key={it.id}){n->OutlinedCard(onClick={read(n.id);open(n)},modifier=Modifier.fillMaxWidth(),colors=CardDefaults.outlinedCardColors(containerColor=if(n.readAt==null)SalesPale else MaterialTheme.colorScheme.surface)){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){Text(n.title,fontWeight=FontWeight.Bold);Text(n.body);Text(salesNotificationTime(n.createdAt),style=MaterialTheme.typography.bodySmall,color=SalesMuted)}}}}}
private fun salesNotificationTime(value:String)=runCatching{java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))}.getOrDefault(value)
