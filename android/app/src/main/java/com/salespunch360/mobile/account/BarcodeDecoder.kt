package com.salespunch360.mobile.account

import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.NotFoundException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer

fun compactBarcodeLuma(data:ByteArray,width:Int,height:Int,rowStride:Int,pixelStride:Int):ByteArray {
 require(width>0&&height>0&&rowStride>=width&&pixelStride>0)
 require((height-1L)*rowStride+(width-1L)*pixelStride<data.size)
 return ByteArray(width*height){index->data[index/width*rowStride+index%width*pixelStride]}
}
fun decodeBarcodeLuma(data:ByteArray,width:Int,height:Int):String? {
 if(width<=0||height<=0||data.size<width.toLong()*height)return null
 var pixels=data
 var frameWidth=width
 var frameHeight=height
 val reader=MultiFormatReader()
 repeat(4){
  val source=PlanarYUVLuminanceSource(pixels,frameWidth,frameHeight,0,0,frameWidth,frameHeight,false)
  try{return reader.decode(BinaryBitmap(HybridBinarizer(source)),mapOf(DecodeHintType.TRY_HARDER to true)).text.takeIf{it.isNotBlank()}}
  catch(_:NotFoundException){}finally{reader.reset()}
  val rotated=ByteArray(frameWidth*frameHeight){index->val x=index%frameHeight;val y=index/frameHeight;pixels[x*frameWidth+(frameWidth-1-y)]}
  pixels=rotated
  val previousWidth=frameWidth;frameWidth=frameHeight;frameHeight=previousWidth
 }
 return null
}
