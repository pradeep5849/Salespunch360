package com.salespunch360.mobile.ui.account.sales

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.data.safeAttachmentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicePdfPreview(id:String,documentType:String="SALES_INVOICE",onClose:()->Unit){
    val context=LocalContext.current
    var file by remember(id){mutableStateOf<File?>(null)}
    var pageIndex by remember(id){mutableIntStateOf(0)}
    var pages by remember(id){mutableIntStateOf(0)}
    var bitmap by remember(id){mutableStateOf<Bitmap?>(null)}
    var error by remember(id){mutableStateOf<String?>(null)}
    LaunchedEffect(id,documentType){
        try{
            val bytes=ApiClient(SecureSession(context)).accountDocumentPdf(documentType,id)
            file=withContext(Dispatchers.IO){safeAttachmentFile(context.cacheDir,"preview-$id.pdf").also{it.writeBytes(bytes)}}
        }catch(_:Exception){error="Document preview could not be loaded."}
    }
    LaunchedEffect(file,pageIndex){
        val source=file?:return@LaunchedEffect
        bitmap=null
        try{
            val result=withContext(Dispatchers.IO){
                ParcelFileDescriptor.open(source,ParcelFileDescriptor.MODE_READ_ONLY).use{descriptor->
                    PdfRenderer(descriptor).use{renderer->
                        renderer.openPage(pageIndex).use{page->
                            val scale=minOf(1200f/page.width,2000f/page.height)
                            val image=Bitmap.createBitmap((page.width*scale).toInt().coerceAtLeast(1),(page.height*scale).toInt().coerceAtLeast(1),Bitmap.Config.ARGB_8888)
                            image.eraseColor(android.graphics.Color.WHITE)
                            page.render(image,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            image to renderer.pageCount
                        }
                    }
                }
            }
            bitmap=result.first;pages=result.second
        }catch(_:Exception){error="Invoice preview could not be rendered."}
    }
    Scaffold(topBar={TopAppBar(title={Text("Invoice Preview")},navigationIcon={TextButton(onClose){Text("Close")}})},bottomBar={Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){TextButton({pageIndex--},enabled=pageIndex>0&&bitmap!=null){Text("Previous")};Text("${pageIndex+1} / ${pages.coerceAtLeast(1)}");TextButton({pageIndex++},enabled=pageIndex+1<pages&&bitmap!=null){Text("Next")}}}){padding->
        Column(Modifier.fillMaxSize().padding(padding).padding(12.dp)){
            error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
            bitmap?.let{Image(it.asImageBitmap(),"Invoice page ${pageIndex+1}",Modifier.fillMaxWidth().weight(1f))}?:run{if(error==null)CircularProgressIndicator()}
        }
    }
}
