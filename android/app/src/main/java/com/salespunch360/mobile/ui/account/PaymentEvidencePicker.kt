package com.salespunch360.mobile.ui.account

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.salespunch360.mobile.account.SaleCreationAttachment
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Selection is local only. Bytes are submitted with the user's explicit payment Save. */
@Composable fun PaymentEvidencePicker(files:List<SaleCreationAttachment>,enabled:Boolean,onFiles:(List<SaleCreationAttachment>)->Unit){
 val context=LocalContext.current;val scope=rememberCoroutineScope()
 var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()){uris->
  if(uris.isNotEmpty()&&!busy){busy=true;error=null;scope.launch{
   try{val selection=withContext(Dispatchers.IO){
    require(uris.size<=50){"Choose no more than 50 files."};var total=0L
    uris.map{uri->
     val mime=context.contentResolver.getType(uri).orEmpty()
     require(mime in listOf("application/pdf","image/png","image/jpeg")){"Choose PDF, PNG or JPEG evidence."}
     var name="attachment";var declared:Long?=null
     context.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)?.use{cursor->if(cursor.moveToFirst()){name=cursor.getString(0)?:name;if(!cursor.isNull(1))declared=cursor.getLong(1)}}
     require(declared==null||declared!!<=10L*1024*1024){"Evidence is limited to 10 MB combined."}
     val bytes=context.contentResolver.openInputStream(uri)?.use{input->
      val output=ByteArrayOutputStream();val buffer=ByteArray(32768)
      while(true){val count=input.read(buffer);if(count<0)break;total+=count;require(total<=10L*1024*1024){"Evidence is limited to 10 MB combined."};output.write(buffer,0,count)}
      output.toByteArray()
     }?:throw IllegalArgumentException("Could not read selected evidence.")
     require(bytes.isNotEmpty()){ "An evidence file is empty." };SaleCreationAttachment(name,mime,bytes)
    }
   };onFiles(selection)}catch(e:Exception){error=e.message?:"Could not read the selected evidence."}finally{busy=false}
  }}
 }
 Column{
  Button(enabled=enabled&&!busy,onClick={picker.launch(arrayOf("application/pdf","image/png","image/jpeg"))}){Text(if(busy)"Reading evidence…"else "Choose payment evidence")}
  files.forEach{Text("${it.name} · ${it.bytes.size} bytes")}
  if(files.isNotEmpty())TextButton(enabled=enabled&&!busy,onClick={onFiles(emptyList())}){Text("Remove selected evidence")}
  error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 }
}
