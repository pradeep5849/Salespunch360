package com.salespunch360.mobile.account

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

fun documentShareName(number:String)=number.replace(Regex("[^A-Za-z0-9._ -]"),"_").take(120).ifBlank{"Document"}

suspend fun prepareDocumentShare(context:Context,number:String,bytes:ByteArray,images:Boolean):List<File> = withContext(Dispatchers.IO){
    require(bytes.size>=4 && bytes.copyOfRange(0,4).toString(Charsets.US_ASCII)=="%PDF"){"The server did not return a PDF. Please retry."}
    val directory=File(context.cacheDir,"shared-documents/${UUID.randomUUID()}").also{check(it.mkdirs())}
    val source=File(directory,"${documentShareName(number)}.pdf").also{it.writeBytes(bytes)}
    try{
        if(!images)return@withContext listOf(source)
        ParcelFileDescriptor.open(source,ParcelFileDescriptor.MODE_READ_ONLY).use{descriptor->PdfRenderer(descriptor).use{renderer->
            require(renderer.pageCount in 1..50){"Share documents over 50 pages as PDF instead."}
            (0 until renderer.pageCount).map{index->renderer.openPage(index).use{page->
                val bitmap=Bitmap.createBitmap((page.width*1.5f).toInt().coerceAtLeast(1),(page.height*1.5f).toInt().coerceAtLeast(1),Bitmap.Config.ARGB_8888)
                try{bitmap.eraseColor(Color.WHITE);page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    File(directory,"${documentShareName(number)}${if(renderer.pageCount>1)"-page-${index+1}" else ""}.png").also{file->file.outputStream().use{check(bitmap.compress(Bitmap.CompressFormat.PNG,100,it)){"Image export failed. Please share as PDF."}}}
                }finally{bitmap.recycle()}
            }}
        }}
    }catch(error:Exception){directory.deleteRecursively();throw error}
    finally{if(images)source.delete()}
}
fun launchDocumentShare(context:Context,files:List<File>,images:Boolean){
    require(files.isNotEmpty())
    val uris=ArrayList(files.map{FileProvider.getUriForFile(context,"${context.packageName}.files",it)})
    val intent=Intent(if(uris.size>1)Intent.ACTION_SEND_MULTIPLE else Intent.ACTION_SEND).setType(if(images)"image/png" else "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    if(uris.size>1)intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris) else intent.putExtra(Intent.EXTRA_STREAM,uris.first())
    intent.clipData=ClipData.newUri(context.contentResolver,"Shared document",uris.first()).apply{uris.drop(1).forEach{addItem(ClipData.Item(it))}}
    context.startActivity(Intent.createChooser(intent,"Share document"))
}

fun homePaymentLabel(type:String,status:String,paymentStatus:String?)=if(type!="SALES_INVOICE")type.replace('_',' ')else if(status!="POSTED")status.replace('_',' ')else when(paymentStatus){"PAID"->"SALE : PAID";"PARTIALLY_PAID"->"SALE : PARTIAL";else->"SALE : UNPAID"}
