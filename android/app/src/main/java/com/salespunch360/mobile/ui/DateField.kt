package com.salespunch360.mobile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.matchParentSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import java.time.Instant
import java.time.ZoneOffset

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label:String,value:String,onValue:(String)->Unit,modifier:Modifier=Modifier){
 var open by remember{mutableStateOf(false)}
 Box(modifier){
  OutlinedTextField(
   value=value,
   onValueChange={},
   readOnly=true,
   singleLine=true,
   label={Text(label)},
   placeholder={Text("Select date")},
   trailingIcon={Icon(Icons.Default.DateRange,"Select date")},
   modifier=Modifier.matchParentSize(),
  )
  Box(Modifier.matchParentSize().clickable{open=true})
 }
 if(open){
  val state=rememberDatePickerState(
   initialSelectedDateMillis=value.takeIf{it.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))}?.let{
    java.time.LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
   },
  )
  DatePickerDialog(
   onDismissRequest={open=false},
   confirmButton={TextButton({state.selectedDateMillis?.let{onValue(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString())};open=false}){Text("Select")}},
   dismissButton={TextButton({open=false}){Text("Cancel")}},
  ){
   DatePicker(state=state,showModeToggle=false)
  }
 }
}
