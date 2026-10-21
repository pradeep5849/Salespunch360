package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SaleCreationAttachmentTest {
 private fun file(name:String="plan.pdf",text:String="%PDF-1.7")=SaleCreationAttachment(name,"application/pdf",text.toByteArray())
 @Test fun selectionAcceptsOnlySupportedNonemptyFilesAndCombinedLimits(){
  assertTrue(validSaleCreationAttachments(emptyList()));assertTrue(validSaleCreationAttachments(listOf(file())))
  assertFalse(validSaleCreationAttachments(listOf(file().copy(bytes=byteArrayOf()))))
  assertFalse(validSaleCreationAttachments(listOf(file().copy(mime="image/svg+xml"))))
  assertFalse(validSaleCreationAttachments(List(51){file()}))
  assertFalse(validSaleCreationAttachments(listOf(file().copy(bytes=ByteArray(10*1024*1024)),file())))
 }
 @Test fun sameBytesAndMetadataKeepRetryIdentityButChangedBytesNameOrOrderDoNot(){
  val first=file();val other=file("two.pdf");val intent=saleAttachmentIntent(listOf(first,other))
  assertEquals(intent,saleAttachmentIntent(listOf(first.copy(bytes=first.bytes.copyOf()),other)))
  assertNotEquals(intent,saleAttachmentIntent(listOf(file(text="%PDF-1.7 changed"),other)))
  assertNotEquals(intent,saleAttachmentIntent(listOf(file("renamed.pdf"),other)))
  assertNotEquals(intent,saleAttachmentIntent(listOf(other,first)))
  assertEquals("",saleAttachmentIntent(emptyList()))
 }
 @Test fun fileIntentChangesIdentityWithoutLeakingNamesOrBytesIntoDocumentPayload(){
  var next=0;val identity=CommercialCreationIdentity{"save-${++next}"}
  val input=buildJsonObject{put("type","SALES_INVOICE")}
  val first=identity.payload(input,saleAttachmentIntent(listOf(file())))
  assertEquals(first,identity.payload(input,saleAttachmentIntent(listOf(file()))))
  val changed=identity.payload(input,saleAttachmentIntent(listOf(file(text="%PDF-1.7 changed"))))
  assertNotEquals(first.str("idempotencyKey"),changed.str("idempotencyKey"))
  assertFalse(first.toString().contains("plan.pdf"));assertFalse(first.toString().contains("%PDF"));assertFalse(first.containsKey("files"))
  assertNotEquals(changed.str("idempotencyKey"),identity.payload(input).str("idempotencyKey"))
  identity.reset();assertNotEquals(first.str("idempotencyKey"),identity.payload(input,saleAttachmentIntent(listOf(file()))).str("idempotencyKey"))
 }
 @Test fun draftPayloadDoesNotSerializePrivateFileBytesOrNames(){
  val draft=SalesEditorDraft(customerId="customer",branchId="branch",attachmentFiles=listOf(file()),lines=listOf(SalesLineDraft(itemName="Work",quantity="1",rate="100")))
  val payload=salesDraftPayload(draft).toString()
  assertFalse(payload.contains("attachmentFiles"));assertFalse(payload.contains("plan.pdf"));assertFalse(payload.contains("%PDF"))
  assertTrue(draft.attachmentFiles.isNotEmpty())
  assertTrue(SalesEditorDraft().attachmentFiles.isEmpty())
 }
}
