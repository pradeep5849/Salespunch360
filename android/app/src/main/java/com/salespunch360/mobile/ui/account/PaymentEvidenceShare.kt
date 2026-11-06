package com.salespunch360.mobile.ui.account
import android.content.Intent
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable fun PaymentEvidenceShare(id:String,name:String,mime:String){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var busy by remember(id){mutableStateOf(false)};var error by remember(id){mutableStateOf<String?>(null)}
 TextButton(enabled=!busy,onClick={busy=true;error=null;scope.launch{try{
  val bytes=api.paymentAttachment(id)
  val file=withContext(Dispatchers.IO){
   context.cacheDir.listFiles()?.filter{it.name.startsWith("sp360-payment-")&&System.currentTimeMillis()-it.lastModified()>86400000L}?.forEach{it.delete()}
   val extension=when(mime){"application/pdf"->".pdf";"image/png"->".png";"image/jpeg"->".jpg";else->throw IllegalArgumentException("Unsupported evidence type")}
   File.createTempFile("sp360-payment-",extension,context.cacheDir).also{it.writeBytes(bytes)}
  }
  val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
  context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share $name"))
 }catch(_:Exception){error="Could not open authorized evidence. Check access and retry."}finally{busy=false}}}){Text(if(busy)"Preparing…"else "Open / share $name")}
 error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
}
