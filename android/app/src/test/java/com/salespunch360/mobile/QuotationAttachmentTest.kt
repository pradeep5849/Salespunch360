package com.salespunch360.mobile
import com.salespunch360.mobile.ui.account.sales.quotationAttachmentExtension
import com.salespunch360.mobile.ui.account.sales.quotationAttachmentError
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.QuotationCreationAttachment
import com.salespunch360.mobile.data.validQuotationCreationAttachments
import org.junit.Assert.*
import org.junit.Test
class QuotationAttachmentTest{
 @Test fun creationSelectionBoundsCombinedBytesCountAndMime(){
  fun file(size:Int=1,mime:String="application/pdf")=QuotationCreationAttachment("plan.pdf",mime,ByteArray(size))
  assertTrue(validQuotationCreationAttachments(listOf(file(6*1024*1024),file(4*1024*1024))))
  assertFalse(validQuotationCreationAttachments(listOf(file(6*1024*1024),file(4*1024*1024+1))))
  assertFalse(validQuotationCreationAttachments(List(51){file()}))
  assertFalse(validQuotationCreationAttachments(listOf(file(0))))
  assertFalse(validQuotationCreationAttachments(listOf(file(mime="text/html"))))
 }
 @Test fun shareExtensionUsesWhitelistedMimeInsteadOfRemoteFilename(){assertEquals("pdf",quotationAttachmentExtension("application/pdf"));assertEquals("png",quotationAttachmentExtension("image/png"));assertEquals("jpg",quotationAttachmentExtension("image/jpeg"));try{quotationAttachmentExtension("text/html");fail("Unsupported content must not be shared as an image")}catch(_:IllegalArgumentException){}}
 @Test fun errorsKeepDatabaseAndStorageDetailsPrivate(){assertEquals("Attachment request failed. Try again.",quotationAttachmentError(Exception("private-storage-path")));assertTrue(quotationAttachmentError(ApiException(409,"QUOTATION_REVISION_CHANGED")).contains("Reopen"));assertTrue(quotationAttachmentError(ApiException(400,"INVALID_QUOTATION_ATTACHMENT")).contains("10 MB"));assertTrue(quotationAttachmentError(ApiException(403,"FORBIDDEN")).contains("access"));assertTrue(quotationAttachmentError(ApiException(401,"UNAUTHORIZED")).contains("Sign in"))}
}
