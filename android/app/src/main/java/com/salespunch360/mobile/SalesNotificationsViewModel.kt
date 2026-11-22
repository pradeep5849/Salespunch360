package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job

data class SalesNotificationsState(val loading:Boolean=false,val data:SalesNotificationsContext=SalesNotificationsContext(),val error:String?=null,val loadingMore:Boolean=false,val updating:Boolean=false)
class SalesNotificationsViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(SalesNotificationsState());val state:StateFlow<SalesNotificationsState> = _state
 private var refreshJob:Job?=null;private var moreJob:Job?=null
 fun refresh(){if(_state.value.updating)return;refreshJob?.cancel();moreJob?.cancel();refreshJob=viewModelScope.launch{_state.value=_state.value.copy(loading=true,loadingMore=false,error=null);try{_state.value=SalesNotificationsState(data=api.salesNotifications())}catch(e:CancellationException){throw e}catch(_:Exception){_state.value=_state.value.copy(loading=false,error="Notifications could not be loaded.")}}}
 fun loadMore(){val current=_state.value;if(current.loading||current.loadingMore||current.updating||!current.data.hasMore)return;_state.value=current.copy(loadingMore=true,error=null);moreJob=viewModelScope.launch{try{val next=api.salesNotifications(current.data.page+1);_state.value=_state.value.copy(loadingMore=false,data=next.copy(items=(_state.value.data.items+next.items).distinctBy{it.id}))}catch(e:CancellationException){throw e}catch(_:Exception){_state.value=_state.value.copy(loadingMore=false,error="More notifications could not be loaded.")}}}
 fun read(id:String?,after:(SalesNotification?)->Unit={}){
  val current=_state.value;if(current.loading||current.loadingMore||current.updating)return
  val item=current.data.items.firstOrNull{it.id==id};_state.value=current.copy(updating=true,error=null)
  viewModelScope.launch{try{
   api.readSalesNotification(id)
   val latest=_state.value;val readAt=java.time.Instant.now().toString()
   val items=latest.data.items.map{if(id==null||it.id==id)it.copy(readAt=it.readAt?:readAt)else it}
   val unread=if(id==null)0 else (latest.data.unreadCount-(if(item?.readAt==null&&item!=null)1 else 0)).coerceAtLeast(0)
   _state.value=latest.copy(updating=false,data=latest.data.copy(items=items,unreadCount=unread));after(item)
  }catch(e:CancellationException){_state.value=_state.value.copy(updating=false);throw e}catch(_:Exception){_state.value=_state.value.copy(updating=false,error="Notification could not be updated. Try again before opening it.")}}
 }
 init{refresh()}
}
