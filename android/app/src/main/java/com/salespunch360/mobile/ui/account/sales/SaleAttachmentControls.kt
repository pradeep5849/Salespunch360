package com.salespunch360.mobile.ui.account.sales

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.salespunch360.mobile.account.SaleCreationAttachment
import com.salespunch360.mobile.account.validSaleCreationAttachments
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.ui.account.expense.readExpenseAttachment
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

@Composable
internal fun SaleCreationFiles(files:List<SaleCreationAttachment>,saving:Boolean,onFiles:(List<SaleCreationAttachment>)->Unit,onReading:(Boolean)->Unit){
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 val currentFiles by rememberUpdatedState(files)
 val currentOnFiles by rememberUpdatedState(onFiles)
 val currentOnReading by rememberUpdatedState(onReading)
 var reading by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->
  if(uri!=null)scope.launch{
   reading=true;currentOnReading(true);error=null
   try{
    val(name,mime,bytes)=readExpenseAttachment(context,uri)
    val combined=currentFiles+SaleCreationAttachment(name,mime,bytes.copyOf())
    require(validSaleCreationAttachments(combined)){"Choose PDF, PNG or JPEG files, up to 50 files and 10 MB combined."}
    currentOnFiles(combined)
   }catch(e:CancellationException){throw e}catch(e:Exception){error=if(e is IllegalArgumentException)e.message else "The file could not be read. Select it again."}finally{reading=false;currentOnReading(false)}
  }
 }
 Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(6.dp)){
  Text("Images and documents",style=MaterialTheme.typography.titleSmall)
  Text("PDF, PNG or JPEG; up to 10 MB in total.",style=MaterialTheme.typography.bodySmall)
  error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
  if(reading)LinearProgressIndicator(Modifier.fillMaxWidth())
  files.forEachIndexed{index,file->
   Text(file.name)
   TextButton(enabled=!saving&&!reading,onClick={currentOnFiles(currentFiles.filterIndexed{position,_->position!=index})}){Text("Remove ${file.name}")}
  }
  OutlinedButton(enabled=!saving&&!reading,onClick={picker.launch(arrayOf("application/pdf","image/png","image/jpeg"))}){Text("Add image or document")}
 }
}

@Composable
internal fun SaleSavedFiles(documentId:String){
 key(documentId){
  val context=LocalContext.current
  val api=remember{ApiClient(SecureSession(context.applicationContext))}
  val scope=rememberCoroutineScope()
  var rows by remember{mutableStateOf<List<JsonObject>>(emptyList())}
  var loading by remember{mutableStateOf(true)}
  var busy by remember{mutableStateOf(false)}
  var error by remember{mutableStateOf<String?>(null)}
  suspend fun load(){loading=true;try{rows=api.saleAttachments(documentId).map{it.jsonObject};error=null}catch(e:CancellationException){throw e}catch(_:Exception){error="Attachments could not be loaded. Try again."}finally{loading=false}}
  LaunchedEffect(documentId){load()}
  Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(6.dp)){
   Text("Attachments",style=MaterialTheme.typography.titleSmall)
   if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
   error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(enabled=!busy,onClick={scope.launch{load()}}){Text("Retry attachments")}}
   if(!loading&&error==null&&rows.isEmpty())Text("No attachments.")
   rows.forEach{row->
    val name=row["displayName"]?.jsonPrimitive?.content.orEmpty()
    Text(name)
    TextButton(enabled=!busy,onClick={scope.launch{
     busy=true;error=null
     try{
      val mime=row["mimeType"]?.jsonPrimitive?.content.orEmpty();val bytes=api.saleAttachment(row["id"]?.jsonPrimitive?.content.orEmpty())
      val file=withContext(Dispatchers.IO){File(context.cacheDir,"sale-attachment-${UUID.randomUUID()}.${quotationAttachmentExtension(mime)}").apply{writeBytes(bytes)}}
      val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
      context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share attachment"))
     }catch(e:CancellationException){throw e}catch(_:Exception){error="The attachment could not be downloaded or shared. Try again."}finally{busy=false}
    }}){Text("Download / share $name")}
   }
  }
 }
}
