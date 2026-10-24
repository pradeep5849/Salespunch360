package com.salespunch360.mobile.account

import java.security.MessageDigest
import kotlinx.serialization.json.*

/** Selection lives only in the open Sale editor; no draft or public upload. */
data class SaleCreationAttachment(val name:String,val mime:String,val bytes:ByteArray)
fun validSaleCreationAttachments(files:List<SaleCreationAttachment>) = files.size<=50 &&
    files.sumOf{it.bytes.size.toLong()}<=10L*1024*1024 &&
    files.all{it.bytes.isNotEmpty() && it.mime in listOf("application/pdf","image/png","image/jpeg")}
fun saleAttachmentIntent(files:List<SaleCreationAttachment>):String {
    if(files.isEmpty())return ""
    return buildJsonArray{files.forEach{file->add(buildJsonObject{
        put("name",file.name);put("mime",file.mime);put("size",file.bytes.size)
        put("hash",MessageDigest.getInstance("SHA-256").digest(file.bytes).joinToString(""){"%02x".format(it)})
    })}}.toString()
}

/** Unknown baselines must use normal financial correction checks, never silently ignore edits. */
fun saleFilesOnlyEdit(draft:SalesEditorDraft):Boolean = draft.editingSourceId.isNotBlank() &&
    draft.attachmentFiles.isNotEmpty() && draft.editingInitialPayload!=null &&
    salesDraftPayload(draft)==draft.editingInitialPayload
