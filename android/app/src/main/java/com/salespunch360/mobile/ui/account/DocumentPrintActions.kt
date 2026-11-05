package com.salespunch360.mobile.ui.account
import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.ui.account.sales.QuotationPdfPreview
import com.salespunch360.mobile.ui.account.sales.SelectField
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
/** Every consumer receives the exact server-authorized PDF. Preview and sharing never post. */
@Composable fun DocumentPrintActions(type:String,id:String,number:String){
 val context=LocalContext.current;val scope=rememberCoroutineScope();val api=remember{ApiClient(SecureSession(context))}
 var bytes by remember(type,id){mutableStateOf<ByteArray?>(null)};var pending by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 var theme by remember{mutableStateOf("REGULAR")};var color by remember{mutableStateOf("#988ee2")}
 SelectField("Preview theme",theme,listOf("REGULAR","MODERN","CLASSIC","MINIMAL").map{it to it}){theme=it}
 OutlinedTextField(color,{color=it},label={Text("Preview colour (#RRGGBB)")})
 Button(enabled=!pending&&Regex("#[0-9a-fA-F]{6}").matches(color),onClick={pending=true;error=null;scope.launch{try{bytes=api.accountDocumentPdf(type,id,theme,color)}catch(_:Exception){error="Could not prepare this authorized PDF. Check your permission or try again."}finally{pending=false}}}){Text(if(pending)"Preparing…" else "Print / Preview / Share")}
 error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 bytes?.let{pdf->QuotationPdfPreview(pdf,onClose={bytes=null},onShare={scope.launch{try{
  val file=withContext(Dispatchers.IO){context.cacheDir.listFiles()?.filter{it.name.startsWith("sp360-document-")&&System.currentTimeMillis()-it.lastModified()>86400000L}?.forEach{it.delete()};File(context.cacheDir,"sp360-document-${java.util.UUID.randomUUID()}.pdf").also{it.writeBytes(pdf)}}
  val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
  context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share $number"))
 }catch(_:Exception){error="Could not open sharing. Retry the PDF preview."}}},documentName=number,previewLabel="Transaction print preview")}
}
