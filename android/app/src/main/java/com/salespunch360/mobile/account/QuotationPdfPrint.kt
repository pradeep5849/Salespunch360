package com.salespunch360.mobile.account

import java.io.InterruptedIOException
import java.io.OutputStream

fun quotationPrintName(reference:String):String {
 val clean=reference.replace(Regex("[\\p{Cntrl}/\\\\:*?\"<>|]"),"_").trim().take(120).ifBlank{"Quotation"}
 return if(clean.endsWith(".pdf",ignoreCase=true))clean else "$clean.pdf"
}
fun requireQuotationPdf(bytes:ByteArray){require(bytes.size>=5&&bytes[0]=='%'.code.toByte()&&bytes[1]=='P'.code.toByte()&&bytes[2]=='D'.code.toByte()&&bytes[3]=='F'.code.toByte()&&bytes[4]=='-'.code.toByte()){ "A valid quotation PDF is required." }}
/** Copies the authorized PDF verbatim. Raster previews never become print data. */
fun copyQuotationPdfForPrint(bytes:ByteArray,output:OutputStream,cancelled:()->Boolean){
 requireQuotationPdf(bytes)
 var offset=0
 while(offset<bytes.size){
  if(cancelled())throw InterruptedIOException("PDF printing cancelled")
  val count=minOf(16384,bytes.size-offset)
  output.write(bytes,offset,count);offset+=count
 }
 if(cancelled())throw InterruptedIOException("PDF printing cancelled")
}
