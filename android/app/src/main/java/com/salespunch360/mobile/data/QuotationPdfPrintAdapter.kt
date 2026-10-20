package com.salespunch360.mobile.data

import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import com.salespunch360.mobile.account.copyQuotationPdfForPrint
import com.salespunch360.mobile.account.quotationPrintName
import com.salespunch360.mobile.account.requireQuotationPdf
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** Static-PDF adapter: report ALL_PAGES because the full original file is written;
 * Android's spooler applies the user's selected ranges, as for a file adapter. */
class QuotationPdfPrintAdapter(bytes:ByteArray,name:String,private val pageCount:Int):PrintDocumentAdapter(){
 private val snapshot=bytes.copyOf()
 private val title=quotationPrintName(name)
 private val worker=Executors.newSingleThreadExecutor()
 private val main=Handler(Looper.getMainLooper())
 @Volatile private var destination:ParcelFileDescriptor?=null
 @Volatile private var finished=false
 init{requireQuotationPdf(snapshot);require(pageCount>0)}
 override fun onLayout(oldAttributes:PrintAttributes?,newAttributes:PrintAttributes?,cancellationSignal:CancellationSignal,callback:LayoutResultCallback,extras:Bundle?){
  if(finished||cancellationSignal.isCanceled){callback.onLayoutCancelled();return}
  callback.onLayoutFinished(PrintDocumentInfo.Builder(title).setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(pageCount).build(),false)
 }
 override fun onWrite(pages:Array<out PageRange>,destination:ParcelFileDescriptor,cancellationSignal:CancellationSignal,callback:WriteResultCallback){
  if(finished){destination.close();callback.onWriteCancelled();return}
  this.destination=destination
  val delivered=AtomicBoolean(false);val task=AtomicReference<Future<*>?>()
  fun cancelled(){if(delivered.compareAndSet(false,true))main.post{callback.onWriteCancelled()}}
  cancellationSignal.setOnCancelListener{runCatching{destination.close()};task.get()?.cancel(true);cancelled()}
  if(cancellationSignal.isCanceled){runCatching{destination.close()};cancelled();return}
  task.set(worker.submit{
   try{
    ParcelFileDescriptor.AutoCloseOutputStream(destination).use{output->copyQuotationPdfForPrint(snapshot,output){finished||cancellationSignal.isCanceled||Thread.currentThread().isInterrupted}}
    if(delivered.compareAndSet(false,true))main.post{callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))}
   }catch(_:Exception){if(finished||cancellationSignal.isCanceled||Thread.currentThread().isInterrupted)cancelled()else if(delivered.compareAndSet(false,true))main.post{callback.onWriteFailed("Could not prepare the quotation PDF for printing.")}}
   finally{if(this.destination===destination)this.destination=null}
  })
  if(cancellationSignal.isCanceled)task.get()?.cancel(true)
 }
 override fun onFinish(){finished=true;runCatching{destination?.close()};destination=null;worker.shutdownNow()}
}
