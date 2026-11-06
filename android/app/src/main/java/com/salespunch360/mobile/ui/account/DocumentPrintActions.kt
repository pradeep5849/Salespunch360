package com.salespunch360.mobile.ui.account
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.salespunch360.mobile.account.launchDocumentShare
import com.salespunch360.mobile.account.prepareDocumentShare
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.ui.account.sales.QuotationPdfPreview
import com.salespunch360.mobile.ui.account.sales.SelectField
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Reuses Home's exact authorized PDF/image handoff. Preview and sharing never post. */
@Composable fun DocumentPrintActions(type:String,id:String,number:String,preferredShareAs:String="ASK"){
 val context=LocalContext.current;val scope=rememberCoroutineScope();val api=remember{ApiClient(SecureSession(context))}
 var bytes by remember(type,id){mutableStateOf<ByteArray?>(null)}
 var pending by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 var theme by remember{mutableStateOf("")};var color by remember{mutableStateOf("")}
 val validColor=color.isBlank()||Regex("#[0-9a-fA-F]{6}").matches(color)
 fun share(images:Boolean,pdf:ByteArray?=null){
  if(pending)return;pending=true;error=null
  scope.launch{try{val document=pdf?:api.accountDocumentPdf(type,id,theme,color);launchDocumentShare(context,prepareDocumentShare(context,number,document,images),images)}catch(e:CancellationException){throw e}catch(_:Exception){error="Could not prepare this authorized document. Retry PDF or check your access."}finally{pending=false}}
 }
 SelectField("Preview theme",theme,listOf("" to "Company default")+listOf("REGULAR","MODERN","CLASSIC","MINIMAL").map{it to it}){theme=it}
 OutlinedTextField(color,{color=it},label={Text("Preview colour (#RRGGBB; blank keeps default)")})
 Button(enabled=!pending&&validColor,onClick={pending=true;error=null;scope.launch{try{bytes=api.accountDocumentPdf(type,id,theme,color)}catch(e:CancellationException){throw e}catch(_:Exception){error="Could not prepare this authorized PDF. Check access and retry."}finally{pending=false}}}){Text(if(pending)"Preparing…"else"Print / Preview")}
 TextButton(enabled=!pending&&validColor,onClick={share(false)}){Text(if(preferredShareAs=="PDF")"Share document (PDF default)"else"Share as PDF")}
 TextButton(enabled=!pending&&validColor,onClick={share(true)}){Text("Share all page images")}
 TextButton(enabled=!pending,onClick={try{context.startActivity(Intent(Intent.ACTION_SENDTO,Uri.parse("smsto:")).putExtra("sms_body","${type.replace('_',' ')} $number"))}catch(_:Exception){error="No SMS app is available. Use PDF sharing instead."}}){Text("Compose SMS summary")}
 Text("Sharing opens your selected app; sending and delivery are not confirmed here.")
 error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 bytes?.let{pdf->QuotationPdfPreview(pdf,onClose={bytes=null},onShare={share(false,pdf)},documentName=number,previewLabel="Transaction print preview")}
}
