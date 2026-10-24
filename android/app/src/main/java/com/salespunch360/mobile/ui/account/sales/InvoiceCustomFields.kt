package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.account.bool
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive

fun invoiceCustomFieldsValid(fields:List<JsonObject>,type:String,values:Map<String,String>):Boolean = fields.filter{it.str("entityType")==type}.all{!it.bool("isRequired")||!values[it.str("fieldKey")].isNullOrBlank()}

@Composable
fun InvoiceCustomFields(fields:List<JsonObject>,type:String,values:Map<String,String>,saving:Boolean,onChange:(Map<String,String>)->Unit){
 Column{
  fields.filter{it.str("entityType")==type}.forEach{field->
   val key=field.str("fieldKey");val value=values[key].orEmpty();val label=field.str("label")+if(field.bool("isRequired"))" *" else ""
   if(field.str("dataType") in listOf("BOOLEAN","SELECT")){
    val choices=if(field.str("dataType")=="BOOLEAN")listOf("" to "Select","true" to "Yes","false" to "No")else listOf("" to "Select")+(field["options"] as? JsonArray).orEmpty().map{it.jsonPrimitive.content.let{v->v to v}}
    SelectField(label,value,choices){if(!saving)onChange(values+(key to it))}
   }else OutlinedTextField(value,{if(it.length<=10000)onChange(values+(key to it))},enabled=!saving,label={Text(label)},minLines=if(field.str("dataType")=="TEXTAREA")3 else 1,modifier=Modifier.fillMaxWidth())
  }
 }
}
