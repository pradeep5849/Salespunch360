/** Retry PostgreSQL serialization/deadlock aborts; never retry domain errors. */
export async function retrySerializable<T>(operation:()=>Promise<T>,attempts=3):Promise<T>{
 for(let attempt=1;;attempt++){
  try{return await operation()}
  catch(error){
   const retryable=error instanceof Error&&"code" in error&&(error.code==="P2034"||error.code==="P2010"&&"meta" in error&&!!error.meta&&typeof error.meta==="object"&&"code" in error.meta&&["40001","40P01"].includes(String(error.meta.code)));
   if(attempt>=attempts||!retryable)throw error;
  }
 }
}
