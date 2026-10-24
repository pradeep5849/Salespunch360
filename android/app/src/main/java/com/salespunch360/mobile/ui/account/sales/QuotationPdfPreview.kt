package com.salespunch360.mobile.ui.account.sales

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.print.PrintManager
import android.print.PrintAttributes
import com.salespunch360.mobile.data.QuotationPdfPrintAdapter
import com.salespunch360.mobile.account.quotationPrintName
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.salespunch360.mobile.account.quotationPdfPageSize
import java.io.File
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private data class QuotationPdfPage(val bitmap:Bitmap,val count:Int)

private suspend fun renderQuotationPage(context:android.content.Context,bytes:ByteArray,number:Int):Result<QuotationPdfPage>{
 return try{Result.success(withContext(Dispatchers.IO){
   val file=File.createTempFile("quotation-preview-",".pdf",context.cacheDir)
   try{
    file.writeBytes(bytes)
    ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
     PdfRenderer(descriptor).use { renderer ->
      renderer.openPage(number).use { source ->
       val (width,height)=quotationPdfPageSize(source.width,source.height)
       val bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888)
       bitmap.eraseColor(Color.WHITE)
       try{source.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)}catch(error:Exception){bitmap.recycle();throw error}
       QuotationPdfPage(bitmap,renderer.pageCount)
      }
     }
    }
   }finally{file.delete()}
  })}catch(error:CancellationException){throw error}catch(error:Exception){Result.failure(error)}
}

@Composable
fun QuotationPdfThumbnail(bytes:ByteArray,modifier:Modifier=Modifier){
 val context=LocalContext.current
 var page by remember(bytes){mutableStateOf<Result<QuotationPdfPage>?>(null)}
 LaunchedEffect(bytes){page=renderQuotationPage(context,bytes,0)}
 Box(modifier,contentAlignment=androidx.compose.ui.Alignment.Center){
  when{page==null->CircularProgressIndicator();page!!.isFailure->Text("Could not display PDF. Retry the preview.",color=MaterialTheme.colorScheme.error);else->Image(page!!.getOrThrow().bitmap.asImageBitmap(),"Selected quotation theme preview",Modifier.fillMaxSize())}
 }
}

/** Renders the exact authorized customer PDF; never reconstructs a private detail DTO. */
@Composable
fun QuotationPdfPreview(bytes:ByteArray,onClose:()->Unit,onShare:()->Unit,documentName:String="Quotation"){
 val context=LocalContext.current
 var printError by remember(bytes){mutableStateOf<String?>(null)}
 var number by remember(bytes){mutableIntStateOf(0)}
 var page by remember(bytes,number){mutableStateOf<Result<QuotationPdfPage>?>(null)}
 LaunchedEffect(bytes,number){
  page=renderQuotationPage(context,bytes,number)
 }
 Dialog(onDismissRequest=onClose,properties=DialogProperties(usePlatformDefaultWidth=false)){
  Surface(Modifier.fillMaxSize()){
   Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
    Text("Quotation print preview",style=MaterialTheme.typography.titleLarge)
    when{
     page==null->Box(Modifier.weight(1f).fillMaxWidth()){CircularProgressIndicator()}
     page!!.isFailure->Box(Modifier.weight(1f).fillMaxWidth()){Text("Could not display this PDF. You can share it or try again.",color=MaterialTheme.colorScheme.error)}
     else->Image(page!!.getOrThrow().bitmap.asImageBitmap(),contentDescription="Quotation PDF page ${number+1}",modifier=Modifier.weight(1f).fillMaxWidth())
    }
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
     OutlinedButton(modifier=Modifier.weight(1f),enabled=page?.isSuccess==true&&number>0,onClick={number--}){Text("Previous page")}
     Text("${number+1} / ${page?.getOrNull()?.count?:"…"}")
     OutlinedButton(modifier=Modifier.weight(1f),enabled=page?.isSuccess==true&&number+1<(page?.getOrNull()?.count?:0),onClick={number++}){Text("Next page")}
    }
    printError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
    OutlinedButton(enabled=page?.isSuccess==true,modifier=Modifier.fillMaxWidth(),onClick={
     try{
      val rendered=page?.getOrNull()?:return@OutlinedButton
      val manager=context.getSystemService(PrintManager::class.java)?:throw IllegalStateException("Printing unavailable")
      val media=if(rendered.bitmap.width>rendered.bitmap.height)PrintAttributes.MediaSize.ISO_A4.asLandscape()else PrintAttributes.MediaSize.ISO_A4
      manager.print(quotationPrintName(documentName),QuotationPdfPrintAdapter(bytes,documentName,rendered.count),PrintAttributes.Builder().setMediaSize(media).build());printError=null
     }catch(_:Exception){printError="Printing is unavailable. Use Share PDF or try again."}
    }){Text("Print PDF")}
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
     OutlinedButton(onClick=onClose,modifier=Modifier.weight(1f)){Text("Close preview")}
     Button(onClick=onShare,modifier=Modifier.weight(1f)){Text("Share PDF")}
    }
   }
  }
 }
}
