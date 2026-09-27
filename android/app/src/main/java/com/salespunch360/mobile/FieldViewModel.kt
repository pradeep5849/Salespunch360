package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException

data class FieldState(
    val loading:Boolean=true,
    val context:FieldContext?=null,
    val leads:List<LeadSummary> = emptyList(),
    val followUps:List<FollowUpTask> = emptyList(),
    val customerPage:Int=1,
    val customerHasMore:Boolean=false,
    val customerLoading:Boolean=false,
    val customerQuery:String="",
    val followUpPage:Int=1,
    val followUpHasMore:Boolean=false,
    val followUpLoading:Boolean=false,
    val followUpQuery:String="",
    val busy:Boolean=false,
    val refreshRequired:Boolean=false,
    val message:String?=null,
)

class FieldViewModel(app:Application):AndroidViewModel(app){
    private val session=SecureSession(app)
    private val api=ApiClient(session)
    private val lookup=FieldLookupClient(session)
    private val _state=MutableStateFlow(FieldState())
    val state:StateFlow<FieldState> = _state
    private var customerLookupJob:Job?=null
    private var followUpLookupJob:Job?=null

    init{refresh()}

    private suspend fun loadFieldState(message:String?=null)=coroutineScope{
        val contextDeferred=async{lookup.customers(page=1)}
        val leadsDeferred=async{api.leads()}
        val followUpsDeferred=async{lookup.visitFollowUps(page=1)}
        val owner=session.userId()
        val context=contextDeferred.await()
        val follow=followUpsDeferred.await()
        FieldState(
            loading=false,
            context=context,
            leads=leadsDeferred.await().filter{it.assignedUserId==owner},
            followUps=follow.tasks,
            customerPage=1,
            customerHasMore=context.customers.size>=50,
            followUpPage=follow.page,
            followUpHasMore=follow.hasMore,
            message=message,
        )
    }

    fun refresh()=viewModelScope.launch{
        customerLookupJob?.cancel();followUpLookupJob?.cancel()
        _state.value=_state.value.copy(loading=true)
        _state.value=try{
            loadFieldState()
        }catch(e:CancellationException){throw e}catch(_:Exception){
            _state.value.copy(loading=false,message="Field information couldn't be loaded.")
        }
    }

    fun searchCustomers(value:String){
        val q=value.take(100)
        customerLookupJob?.cancel()
        _state.value=_state.value.copy(customerLoading=true,customerQuery=q,customerPage=1)
        customerLookupJob=viewModelScope.launch{
            try{
                val result=lookup.customers(q,1)
                _state.value=_state.value.copy(context=result,customerPage=1,customerHasMore=result.customers.size>=50,customerLoading=false)
            }catch(e:CancellationException){throw e}catch(e:Exception){
                _state.value=_state.value.copy(customerLoading=false,message=apiMessage(e,"Customers couldn't be loaded."))
            }
        }
    }

    fun moreCustomers(){
        val current=_state.value
        if(current.customerLoading||!current.customerHasMore)return
        val existing=current.context?:return
        customerLookupJob?.cancel()
        _state.value=current.copy(customerLoading=true)
        customerLookupJob=viewModelScope.launch{
            try{
                val nextPage=current.customerPage+1
                val result=lookup.customers(current.customerQuery,nextPage)
                val combined=(existing.customers+result.customers).distinctBy{it.id}
                _state.value=_state.value.copy(context=result.copy(customers=combined),customerPage=nextPage,customerHasMore=result.customers.size>=50,customerLoading=false)
            }catch(e:CancellationException){throw e}catch(e:Exception){
                _state.value=_state.value.copy(customerLoading=false,message=apiMessage(e,"More customers couldn't be loaded."))
            }
        }
    }

    fun searchFollowUps(value:String){
        val q=value.take(100)
        followUpLookupJob?.cancel()
        _state.value=_state.value.copy(followUpLoading=true,followUpQuery=q,followUpPage=1)
        followUpLookupJob=viewModelScope.launch{
            try{
                val result=lookup.visitFollowUps(q,1)
                _state.value=_state.value.copy(followUps=result.tasks,followUpPage=result.page,followUpHasMore=result.hasMore,followUpLoading=false)
            }catch(e:CancellationException){throw e}catch(e:Exception){
                _state.value=_state.value.copy(followUpLoading=false,message=apiMessage(e,"Scheduled follow-ups couldn't be loaded."))
            }
        }
    }

    fun moreFollowUps(){
        val current=_state.value
        if(current.followUpLoading||!current.followUpHasMore)return
        followUpLookupJob?.cancel()
        _state.value=current.copy(followUpLoading=true)
        followUpLookupJob=viewModelScope.launch{
            try{
                val result=lookup.visitFollowUps(current.followUpQuery,current.followUpPage+1)
                _state.value=_state.value.copy(followUps=(current.followUps+result.tasks).distinctBy{it.id},followUpPage=result.page,followUpHasMore=result.hasMore,followUpLoading=false)
            }catch(e:CancellationException){throw e}catch(e:Exception){
                _state.value=_state.value.copy(followUpLoading=false,message=apiMessage(e,"More scheduled follow-ups couldn't be loaded."))
            }
        }
    }

    fun checkIn(type:String,subjectId:String?,name:String?,phone:String?,location:LocationPayload,notes:String?,photo:ByteArray?,followUpTaskId:String?=null){
        mutate("Checked in."){api.checkIn(type,subjectId,name,phone,location,notes,photo,followUpTaskId)}
    }

    fun checkout(visitId:String,location:LocationPayload,sentiment:VisitSentiment,remarks:String?,onSuccess:()->Unit={}){
        mutate("Checkout completed.",onSuccess){api.checkout(visitId,location,sentiment,remarks)}
    }

    fun addPhone(visitId:String,phone:String){
        mutate("Phone added and Lead created."){api.addPendingPhone(visitId,phone)}
    }

    fun createLead(visitId:String,title:String){
        mutate("Lead created from visit."){api.leadFromVisit(visitId,title)}
    }

    fun locationError(message:String){_state.value=_state.value.copy(message=message)}
    fun clear(){_state.value=_state.value.copy(message=null)}

    private fun mutate(success:String,onSuccess:()->Unit={},action:suspend()->Unit){
        if(_state.value.busy||_state.value.refreshRequired)return
        _state.value=_state.value.copy(busy=true,message=null)
        viewModelScope.launch{
            try{
                action()
                _state.value=_state.value.copy(busy=false,message=success,refreshRequired=true)
                onSuccess()
                try{_state.value=loadFieldState(success)}catch(e:CancellationException){throw e}catch(_:Exception){_state.value=_state.value.copy(busy=false,message="$success Refresh pending. Tap Refresh before another action.")}

                delay(2500)
                if(_state.value.message==success){
                    _state.value=_state.value.copy(message=null)
                }
            }catch(e:CancellationException){throw e}catch(e:ApiException){
                _state.value=_state.value.copy(
                    busy=false,
                    message=when(e.code){
                        "ATTENDANCE_REQUIRED"->"Start attendance before checking in."
                        "CHECKOUT_REQUIRED"->"Complete your current checkout first."
                        "REPEAT_VISIT_OUTSIDE_RADIUS"->"You are outside the allowed 50 m check-in radius. Current distance: ${e.distanceMeters?.toInt()?:"unknown"} m."
                        "PHOTO_REQUIRED"->"A photo is required for this check-in."
                        "PHOTO_INVALID"->"Unable to process this photo. Please take it again."
                        "PHOTO_STORAGE_NOT_CONFIGURED"->"Photo storage is not configured. Contact your administrator."
                        "PHOTO_STORAGE_UNAVAILABLE"->"Photo storage is temporarily unavailable."
                        "SUBJECT_OWNERSHIP_CONFLICT"->"This subject requires assignment resolution."
                        "OUTSIDE_RADIUS"->"You are outside the configured customer area."
                        "INSUFFICIENT_ACCURACY"->"Location accuracy isn't sufficient. Try again outdoors."
                        else->apiMessage(e,"The action couldn't be completed.")
                    },
                )
            }catch(e:CancellationException){throw e}catch(_:Exception){
                _state.value=_state.value.copy(busy=false,refreshRequired=true,message="Could not confirm this action. Refresh before trying again.")
            }
        }
    }
}
