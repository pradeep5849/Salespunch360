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
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.ui.account.expense.readExpenseAttachment
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

internal fun quotationAttachmentExtension(mime:String)=when(mime){"application/pdf"->"pdf";"image/png"->"png";"image/jpeg"->"jpg";else->throw IllegalArgumentException("Unsupported attachment type.")}
internal fun quotationAttachmentError(error:Exception)=when((error as? ApiException)?.code){
    "INVALID_QUOTATION_ATTACHMENT"->"Choose a PDF, PNG or JPEG file up to 10 MB."
    "QUOTATION_REVISION_CHANGED","DRAFT_NOT_EDITABLE"->"The revision changed. Reopen this document before changing attachments."
    "IDEMPOTENCY_KEY_REUSED"->"Select the file again before retrying."
    "QUOTATION_ATTACHMENT_LIMIT"->"A revision can contain at most 50 attachments."
    "UNAUTHORIZED"->"Your session expired. Sign in again."
    "FORBIDDEN"->"You do not have access to these attachments."
    "SUBSCRIPTION_REQUIRED"->"An active subscription is required to change attachments."
    else->if(error is IllegalArgumentException)error.message?:"Attachment could not be read." else "Attachment request failed. Try again."
}
private data class PendingAttachment(val name:String,val mime:String,val bytes:ByteArray,val key:String=UUID.randomUUID().toString())
private fun JsonObject.text(key:String)=(get(key) as? JsonPrimitive)?.contentOrNull.orEmpty()

@Composable
internal fun QuotationAttachmentControls(documentId:String,revision:Int,canEdit:Boolean){
    key(documentId,revision){
        val context=LocalContext.current
        val api=remember{ApiClient(SecureSession(context.applicationContext))}
        val scope=rememberCoroutineScope()
        var rows by remember{mutableStateOf<List<JsonObject>>(emptyList())}
        var loading by remember{mutableStateOf(true)}
        var busy by remember{mutableStateOf(false)}
        var error by remember{mutableStateOf<String?>(null)}
        var message by remember{mutableStateOf<String?>(null)}
        var pending by remember{mutableStateOf<PendingAttachment?>(null)}
        suspend fun load(){
            loading=true
            try{rows=api.quotationAttachments(documentId,revision).map{it.jsonObject};error=null}catch(e:CancellationException){throw e}catch(e:Exception){error=quotationAttachmentError(e)}finally{loading=false}
        }
        suspend fun upload(file:PendingAttachment){
            if(busy)return
            busy=true;error=null;message=null
            try{api.uploadQuotationAttachment(documentId,revision,file.key,file.name,file.mime,file.bytes);pending=null;message="Attachment added.";load()}catch(e:CancellationException){throw e}catch(e:Exception){error=quotationAttachmentError(e)}finally{busy=false}
        }
        val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->
            if(uri!=null)scope.launch{
                busy=true;error=null
                try{val(name,mime,bytes)=readExpenseAttachment(context,uri);quotationAttachmentExtension(mime);val file=PendingAttachment(name,mime,bytes);pending=file;busy=false;upload(file)}catch(e:CancellationException){throw e}catch(e:Exception){error=quotationAttachmentError(e)}finally{busy=false}
            }
        }
        LaunchedEffect(documentId,revision){load()}
        Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(6.dp)){
            Text("Images and documents",style=MaterialTheme.typography.titleSmall)
            Text("Private to authorized company users. Not included in customer PDF or public link.",style=MaterialTheme.typography.bodySmall)
            if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
            error?.let{Text(it,color=MaterialTheme.colorScheme.error);TextButton(onClick={scope.launch{val retry=pending;if(retry!=null&&canEdit)upload(retry)else load()}},enabled=!busy){Text(if(pending!=null&&canEdit)"Retry upload"else"Retry attachments")}}
            message?.let{Text(it)}
            if(!loading&&error==null&&rows.isEmpty())Text("No attachments.")
            rows.forEach{row->
                Text(row.text("displayName"))
                TextButton(onClick={scope.launch{
                    busy=true;error=null
                    try{
                        val bytes=api.quotationAttachment(row.text("id"));val mime=row.text("mimeType")
                        val file=withContext(Dispatchers.IO){File(context.cacheDir,"quotation-attachment-${UUID.randomUUID()}.${quotationAttachmentExtension(mime)}").apply{writeBytes(bytes)}}
                        val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share attachment"))
                    }catch(e:CancellationException){throw e}catch(e:Exception){error=quotationAttachmentError(e)}finally{busy=false}
                }},enabled=!busy){Text("Download / share ${row.text("displayName")}")}
                if(canEdit)TextButton(onClick={scope.launch{
                    busy=true;error=null;message=null
                    try{api.removeQuotationAttachment(row.text("id"),documentId,revision);message="Attachment removed.";load()}catch(e:CancellationException){throw e}catch(e:Exception){error=quotationAttachmentError(e)}finally{busy=false}
                }},enabled=!busy){Text("Remove ${row.text("displayName")}")}
            }
            if(canEdit)OutlinedButton(onClick={picker.launch(arrayOf("application/pdf","image/png","image/jpeg"))},enabled=!busy&&!loading){Text(if(busy)"Working…"else"Add PDF / image")}
        }
    }
}
