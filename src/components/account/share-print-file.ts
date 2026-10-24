/** Server authorization remains authoritative; never share an error page as a PDF. */
export async function preparePrintPdf(url:string,number:string):Promise<File>{
 const response=await fetch(url,{cache:"no-store"});
 if(!response.ok)throw new Error(response.status===403?"You do not have permission to share this document.":"Could not prepare this document. Please try again.");
 if(!response.headers.get("content-type")?.startsWith("application/pdf"))throw new Error("The server did not return a PDF. Please try again.");
 const blob=await response.blob();
 if(blob.size===0)throw new Error("The PDF is empty. Please try again.");
 return new File([blob],`${number.replace(/[\\/\r\n]/g,"_")}.pdf`,{type:"application/pdf"});
}
export function isShareCancellation(error:unknown){return error instanceof Error&&error.name==="AbortError";}
