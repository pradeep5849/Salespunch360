package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class AddItemState(
    val loading:Boolean=true,
    val saving:Boolean=false,
    val configLoaded:Boolean=false,
    val hsnCodes:List<String> = emptyList(),
    val units:List<AccountOption> = emptyList(),
    val categories:List<AccountOption> = emptyList(),
    val serviceCategories:List<AccountOption> = emptyList(),
    val productFields:List<AccountCustomField> = emptyList(),
    val serviceFields:List<AccountCustomField> = emptyList(),
    val itemSettings:JsonObject=JsonObject(emptyMap()),
    val error:String?=null
)

class AccountAddItemViewModel(app:Application):AndroidViewModel(app){
    private val api=ApiClient(SecureSession(app))
    private val _state=MutableStateFlow(AddItemState())
    val state=_state.asStateFlow()

    init{load()}

    fun load()=viewModelScope.launch{
        _state.value=_state.value.copy(loading=true,configLoaded=false,error=null)
        runCatching{api.accountMasterOptions("items") to api.accountMasterOptions("services")}.onSuccess{(products,services)->
            _state.value=_state.value.copy(loading=false,configLoaded=true,hsnCodes=(products.hsnCodes+services.hsnCodes).distinct().sorted(),units=products.units,categories=products.categories,serviceCategories=services.categories,itemSettings=products.itemSettings,error=null,productFields=products.partyCustomFields,serviceFields=services.partyCustomFields)
        }.onFailure{_state.value=_state.value.copy(loading=false,error="Unable to load item options.")}
    }

    fun createUnit(name:String,symbol:String,done:(AccountOption)->Unit)=viewModelScope.launch{
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster("units",null,buildJsonObject{put("name",name.trim());put("symbol",symbol.trim())})
        }.onSuccess{row->
            val option=AccountOption(row.id,row.name,row.code ?: symbol.trim())
            _state.value=_state.value.copy(saving=false,units=(_state.value.units+option).distinctBy{it.id})
            done(option)
        }.onFailure{_state.value=_state.value.copy(saving=false,error="Unit could not be saved.")}
    }

    fun createCategory(name:String,service:Boolean,done:(AccountOption)->Unit)=viewModelScope.launch{
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster("categories",null,buildJsonObject{put("name",name.trim());put("scope",if(service)"SERVICE" else "PRODUCT")})
        }.onSuccess{row->
            val option=AccountOption(row.id,row.name)
            _state.value=if(service)_state.value.copy(saving=false,serviceCategories=(_state.value.serviceCategories+option).distinctBy{it.id})else _state.value.copy(saving=false,categories=(_state.value.categories+option).distinctBy{it.id})
            done(option)
        }.onFailure{_state.value=_state.value.copy(saving=false,error="Category could not be saved.")}
    }

    fun save(
        service:Boolean,
        name:String,
        unitId:String?,
        categoryId:String?,
        code:String,
        description:String,
        sellingRate:String,
        cost:String,
        taxRate:String,
        hsnSac:String,
        trackInventory:Boolean,
        lowStockThreshold:String,
        customFields:Map<String,String> = emptyMap(),
        done:()->Unit
    )=viewModelScope.launch{
        if(_state.value.saving||!_state.value.configLoaded)return@launch
        _state.value=_state.value.copy(saving=true,error=null)
        runCatching{
            api.saveAccountMaster(
                if(service)"services" else "items",
                null,
                buildJsonObject{
                    put("name",name.trim())
                    putJsonObject("customFields"){customFields.forEach{put(it.key,it.value)}}
                    put("code",code.trim())
                    unitId?.let{put("unitId",it)}
                    categoryId?.let{put("categoryId",it)}
                    put("description",description)
                    put("sellingRate",sellingRate.ifBlank{"0"})
                    put("cost",cost.ifBlank{"0"})
                    put("taxRate",taxRate.ifBlank{"0"})
                    put("hsnSacCode",hsnSac)
                    if(!service){
                        put("barcode",code.trim())
                        put("trackInventory",trackInventory)
                        put("trackingMode","NONE")
                        put("lowStockThreshold",lowStockThreshold.ifBlank{"0"})
                    }
                }
            )
        }.onSuccess{
            _state.value=_state.value.copy(saving=false)
            done()
        }.onFailure{_state.value=_state.value.copy(saving=false,error="Item could not be saved.")}
    }
}
