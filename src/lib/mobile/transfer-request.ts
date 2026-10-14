/** Bound native image JSON before JSON.parse; headers alone are not trusted. */
export async function readTransferRequestJson(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new SyntaxError("Empty request");const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8*1024*1024){await reader.cancel();throw new SyntaxError("Request too large");}chunks.push(chunk.value);}}
 finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
