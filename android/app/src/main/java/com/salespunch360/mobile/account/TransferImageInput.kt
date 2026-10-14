package com.salespunch360.mobile.account
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import java.io.ByteArrayOutputStream
const val TRANSFER_IMAGE_MAX_BYTES=5*1024*1024
fun transferImagePayload(name:String,mime:String,bytes:ByteArray):JsonObject {
 require(bytes.isNotEmpty()&&bytes.size<=TRANSFER_IMAGE_MAX_BYTES&&mime in listOf("image/png","image/jpeg","image/webp")){"Choose a PNG, JPEG or WebP image up to 5 MB."}
 return buildJsonObject{put("name",name.take(240));put("mimeType",mime);put("base64",java.util.Base64.getEncoder().encodeToString(bytes))}
}
suspend fun readTransferImageInput(context:Context,uri:Uri):JsonObject=withContext(Dispatchers.IO){
 var name="transfer.png";context.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)?.use{cursor->if(cursor.moveToFirst()){name=cursor.getString(0)?:name;require(cursor.isNull(1)||cursor.getLong(1)<=TRANSFER_IMAGE_MAX_BYTES){"Image is larger than 5 MB."}}}
 val stream=context.contentResolver.openInputStream(uri)?:throw IllegalArgumentException("Image could not be opened.");val output=ByteArrayOutputStream();stream.use{input->val chunk=ByteArray(32*1024);while(true){val count=input.read(chunk);if(count<0)break;require(output.size()+count<=TRANSFER_IMAGE_MAX_BYTES){"Image is larger than 5 MB."};output.write(chunk,0,count)}}
 transferImagePayload(name,context.contentResolver.getType(uri).orEmpty(),output.toByteArray())
}
