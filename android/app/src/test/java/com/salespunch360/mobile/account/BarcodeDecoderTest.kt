package com.salespunch360.mobile.account
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import org.junit.Assert.*
import org.junit.Test
class BarcodeDecoderTest {
 @Test fun readsAnItemQrCodeFromCameraLuminance(){
  val image=MultiFormatWriter().encode("ITEM-QR-123",BarcodeFormat.QR_CODE,240,240)
  val data=ByteArray(240*240){index->if(image[index%240,index/240])0 else 255.toByte()}
  assertEquals("ITEM-QR-123",decodeBarcodeLuma(data,240,240))
 }
 @Test fun readsARotatedRetailBarcode(){
  val image=MultiFormatWriter().encode("5901234123457",BarcodeFormat.EAN_13,360,180)
  val data=ByteArray(360*180){index->val x=index%180;val y=index/180;if(image[y,179-x])0 else 255.toByte()}
  assertEquals("5901234123457",decodeBarcodeLuma(data,180,360))
 }
 @Test fun removesCameraRowAndPixelPadding(){assertArrayEquals(byteArrayOf(1,2,3,4),compactBarcodeLuma(byteArrayOf(1,9,2,9,9,9,3,9,4),2,2,6,2))}
 @Test fun unreadableAndIncompleteFramesDoNotReturnAnItem(){assertNull(decodeBarcodeLuma(ByteArray(100*100){255.toByte()},100,100));assertNull(decodeBarcodeLuma(byteArrayOf(1),100,100));assertTrue(runCatching{compactBarcodeLuma(byteArrayOf(1),100,100,100,1)}.isFailure)}
}
