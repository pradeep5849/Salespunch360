package com.salespunch360.mobile.ui
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import java.time.Instant
import java.time.ZoneOffset
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun DateField(label:String,value:String,onValue:(String)->Unit,modifier:Modifier=Modifier){var open by remember{mutableStateOf(false)};OutlinedButton({open=true},modifier){Text(if(value.isBlank())label else "$label · $value")};if(open){val state=rememberDatePickerState(initialSelectedDateMillis=value.takeIf{it.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))}?.let{java.time.LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()});DatePickerDialog(onDismissRequest={open=false},confirmButton={TextButton({state.selectedDateMillis?.let{onValue(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString())};open=false}){Text("Select")}},dismissButton={TextButton({open=false}){Text("Cancel")}}){DatePicker(state=state,showModeToggle=false)}}}
