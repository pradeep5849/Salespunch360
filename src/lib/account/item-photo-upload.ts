/** Bound chunked multipart bodies too: Content-Length is only an early rejection. */
export async function itemPhotoForm(request:Request){
 const limit=5*1024*1024+65536;
 if(Number(request.headers.get("content-length"))>limit)throw new Error("INVALID_ITEM_PHOTO");
 const reader=request.body?.getReader();if(!reader)throw new Error("INVALID_ITEM_PHOTO");
 const chunks:Uint8Array[]= [];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error("INVALID_ITEM_PHOTO")}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return await new Response(bytes,{headers:{"content-type":request.headers.get("content-type")??""}}).formData()}catch{throw new Error("INVALID_ITEM_PHOTO")}
}
