import type { CommercialCreateResult } from "./commercial-action-errors";

/** Called by explicit Save only. Keep the same request identity across retries. */
export async function submitSaleWithAttachments(document: unknown, payment: unknown, files: File[],sourceId?:string): Promise<CommercialCreateResult> {
  const body = new FormData();
  body.set("document", JSON.stringify(document));
  body.set("payment", JSON.stringify(payment));
  for (const file of files) body.append("attachments", file);
  const response = await fetch(sourceId?`/api/account/sales/${encodeURIComponent(sourceId)}/with-attachments`:"/api/account/sales/with-attachments", { method: sourceId?"PATCH":"POST", body, credentials: "same-origin" });
  const result: unknown = await response.json().catch(() => null);
  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;
    if (response.ok && value.ok === true && typeof value.id === "string" && typeof value.documentNumber === "string") return { ok: true, id: value.id, documentNumber: value.documentNumber };
    if (!response.ok && typeof value.message === "string") return { ok: false, errorCode: typeof value.errorCode === "string" ? value.errorCode : "SAVE_FAILED", message: value.message };
  }
  return { ok: false, errorCode: "SAVE_FAILED", message: "The Sale could not be saved. Your selected attachments are still here; check your connection and try again." };
}
export async function appendSaleWithAttachments(sourceId:string,requestKey:string,files:File[]):Promise<{ok:true}|Extract<CommercialCreateResult,{ok:false}>>{
  const body=new FormData();body.set("requestKey",requestKey);for(const file of files)body.append("attachments",file);
  const response=await fetch(`/api/account/sales/${encodeURIComponent(sourceId)}/attachments`,{method:"POST",body,credentials:"same-origin"});
  const result:unknown=await response.json().catch(()=>null);
  if(result&&typeof result==="object"){
    const value=result as Record<string,unknown>;
    if(response.ok&&value.ok===true)return{ok:true};
    if(!response.ok&&typeof value.message==="string")return{ok:false,errorCode:typeof value.errorCode==="string"?value.errorCode:"SAVE_FAILED",message:value.message};
  }
  return{ok:false,errorCode:"SAVE_FAILED",message:"The attachments could not be saved. Your selection is still here; try again."};
}
