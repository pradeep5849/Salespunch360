package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
class TransferImageInputTest {
 @Test fun encodesCanonicalBoundedNativePayload(){val bytes=byteArrayOf(1,2,3);val value=transferImagePayload("x".repeat(300),"image/png",bytes);assertEquals(240,value["name"]!!.jsonPrimitive.content.length);assertEquals("AQID",value["base64"]!!.jsonPrimitive.content);assertEquals("image/png",value["mimeType"]!!.jsonPrimitive.content)}
 @Test fun rejectsEmptyOversizedAndUnsupportedImages(){for(pair in listOf("image/png" to byteArrayOf(),"image/svg+xml" to byteArrayOf(1),"image/png" to ByteArray(TRANSFER_IMAGE_MAX_BYTES+1))){try{transferImagePayload("proof",pair.first,pair.second);fail("Invalid image accepted")}catch(expected:IllegalArgumentException){}}}
}
