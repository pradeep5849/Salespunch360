package com.salespunch360.mobile.ui.account.accounting
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.account.sales.SelectField
import kotlinx.coroutines.launch
@Composable fun NumberingRestartScreen(padding:PaddingValues,onBack:()->Unit){
 val branchUi=com.salespunch360.mobile.ui.LocalBranchUiEnabled.current
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var options by remember{mutableStateOf<List<NumberingRestartOption>>(emptyList())};var series by remember{mutableStateOf("")};var prefix by remember{mutableStateOf("")};var reason by remember{mutableStateOf("")}
 var review by remember{mutableStateOf<NumberingRestartReview?>(null)};var confirmed by remember{mutableStateOf(false)};var busy by remember{mutableStateOf(true)};var message by remember{mutableStateOf<String?>(null)};var retry by remember{mutableStateOf(0)}
 LaunchedEffect(retry){busy=true;try{options=api.numberingRestartOptions();if(series.isBlank())series=options.firstOrNull()?.id.orEmpty()}catch(e:Exception){message=(e as? ApiException)?.serverMessage?:"Could not load authorized numbering series."}finally{busy=false}}
 Column(Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)){
  TextButton(onClick=onBack){Text("Back")};Text("Restart future numbering",style=MaterialTheme.typography.headlineSmall)
  Text("Existing documents and their numbers remain unchanged. This does not close a financial year or remove transactions. Use a completely new prefix.")
  if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
  if(!busy){SelectField(if(branchUi)"Branch and series" else "Document series",series,options.map{it.id to "${if(branchUi)it.branch+" · " else ""}${it.type.replace('_',' ')} · ${it.prefix}${it.nextSequence}"}){series=it;review=null;confirmed=false}}
  OutlinedTextField(prefix,{prefix=it;review=null;confirmed=false},enabled=!busy,label={Text("New prefix · e.g. FY2026-SI/")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(reason,{reason=it;review=null;confirmed=false},enabled=!busy,label={Text("Reason")},modifier=Modifier.fillMaxWidth())
  Button(enabled=!busy&&series.isNotBlank(),onClick={busy=true;message=null;scope.launch{try{review=api.previewNumberingRestart(series,prefix,reason);confirmed=false}catch(e:Exception){message=(e as? ApiException)?.serverMessage?:"Could not prepare a numbering preview."}finally{busy=false}}}){Text("Preview restart")}
  review?.let{current->Text("${if(branchUi)current.branch+" · " else ""}${current.type.replace('_',' ')}",style=MaterialTheme.typography.titleMedium);Text("Previous prefix: ${current.previousPrefix.ifBlank{"none"}}; next sequence ${current.previousNextSequence}");Text("New sequence begins at 1:");current.examples.forEach{Text(it)};Text("Preview expires ${current.expiresAt}. The server rechecks it before saving.");Row{Checkbox(confirmed,{confirmed=it},enabled=!busy);Text("I confirm this applies only to future documents.")};Button(enabled=!busy&&confirmed,onClick={busy=true;message=null;scope.launch{try{api.confirmNumberingRestart(current.token);review=null;confirmed=false;message="Future numbering restarted. Historical documents are unchanged.";runCatching{api.numberingRestartOptions()}.onSuccess{options=it}.onFailure{message="Restart saved; refresh to reload the current series."}}catch(e:Exception){message=(e as? ApiException)?.serverMessage?:"No success confirmed. Retry with the same preview."}finally{busy=false}}}){Text("Confirm numbering restart")}}
  message?.let{Text(it)};if(!busy&&options.isEmpty())Text("No active supported series. Create its document normally first.");TextButton(onClick={retry++},enabled=!busy){Text("Refresh series")}
 }
}
