package com.salespunch360.mobile
import com.salespunch360.mobile.ui.account.sales.quotationAttachmentExtension
import com.salespunch360.mobile.ui.account.sales.quotationAttachmentError
import com.salespunch360.mobile.data.ApiException
import org.junit.Assert.*
import org.junit.Test
class QuotationAttachmentTest{
 @Test fun shareExtensionUsesWhitelistedMimeInsteadOfRemoteFilename(){assertEquals("pdf",quotationAttachmentExtension("application/pdf"));assertEquals("png",quotationAttachmentExtension("image/png"));assertEquals("jpg",quotationAttachmentExtension("image/jpeg"));try{quotationAttachmentExtension("text/html");fail("Unsupported content must not be shared as an image")}catch(_:IllegalArgumentException){}}
 @Test fun errorsKeepDatabaseAndStorageDetailsPrivate(){assertEquals("Attachment request failed. Try again.",quotationAttachmentError(Exception("private-storage-path")));assertTrue(quotationAttachmentError(ApiException(409,"QUOTATION_REVISION_CHANGED")).contains("Reopen"));assertTrue(quotationAttachmentError(ApiException(400,"INVALID_QUOTATION_ATTACHMENT")).contains("10 MB"));assertTrue(quotationAttachmentError(ApiException(403,"FORBIDDEN")).contains("access"));assertTrue(quotationAttachmentError(ApiException(401,"UNAUTHORIZED")).contains("Sign in"))}
}
