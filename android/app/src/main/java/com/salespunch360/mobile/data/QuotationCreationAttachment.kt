package com.salespunch360.mobile.data

/** In-memory selection only; never persisted as a document or written to public storage. */
data class QuotationCreationAttachment(val name:String,val mime:String,val bytes:ByteArray)
fun validQuotationCreationAttachments(files:List<QuotationCreationAttachment>) = files.size<=50 &&
    files.sumOf{it.bytes.size.toLong()}<=10L*1024*1024 &&
    files.all{it.bytes.isNotEmpty() && it.mime in listOf("application/pdf","image/png","image/jpeg")}
