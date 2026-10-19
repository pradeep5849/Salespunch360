import {z} from "zod";
import {AuthenticationError,AuthorizationError} from "@/lib/auth/authorization";
import {isRedirectError} from "next/dist/client/components/redirect-error";
import {QuotationAttachmentError} from "./attachments";
export async function boundedQuotationMultipart(request:Request){
 const limit=11*1024*1024,length=Number(request.headers.get("content-length"));
 if(length>limit)throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
 const reader=request.body?.getReader();if(!reader)throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
 const parts:Uint8Array[]= [];let total=0;
 try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>limit){await reader.cancel();throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT")}parts.push(part.value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 let form:FormData;try{form=await new Response(bytes,{headers:{"content-type":request.headers.get("content-type")??""}}).formData()}catch{throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT")}
 return form;
}
export async function quotationAttachmentForm(request:Request){
 const form=await boundedQuotationMultipart(request);
 const file=form.get("file");if(!(file instanceof File))throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
 return {file,revisionNumber:Number(form.get("revisionNumber")??NaN),requestKey:String(form.get("requestKey")??"")};
}
export async function quotationCreationForm(request:Request){
 const form=await boundedQuotationMultipart(request),files=form.getAll("attachments");
 if(files.some(file=>!(file instanceof File)))throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
 let document:unknown;try{document=JSON.parse(String(form.get("document")))}catch{throw new QuotationAttachmentError("INVALID_INPUT")}
 if(!document||typeof document!=="object"||Array.isArray(document))throw new QuotationAttachmentError("INVALID_INPUT");
 const customFields=Object.fromEntries(Array.from(form.entries()).filter(([key])=>key.startsWith("custom_")).map(([key,value])=>[key.slice(7),String(value)]));
 return {document:{...document,...(Object.keys(customFields).length?{customFields}:{}),creationRequestKey:String(form.get("creationRequestKey")??"")},files:files as File[]};
}
export const attachmentJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
export function quotationAttachmentFailure(error:unknown){
 if(isRedirectError(error))throw error;
 const message=error instanceof Error?error.message:"";
 if(error instanceof AuthenticationError||message==="MOBILE_UNAUTHORIZED")return attachmentJson({error:"UNAUTHORIZED"},401);
 if(error instanceof AuthorizationError||["MOBILE_FORBIDDEN","NOT_AUTHORIZED","Not authorized","UNTRUSTED_ORIGIN"].includes(message)||message.startsWith("MODULE_DISABLED:"))return attachmentJson({error:"FORBIDDEN"},403);
 if(message==="SUBSCRIPTION_REQUIRED")return attachmentJson({error:"SUBSCRIPTION_REQUIRED"},403);
 if(message==="RATE_LIMITED")return attachmentJson({error:"RATE_LIMITED"},429);
 if(error instanceof z.ZodError)return attachmentJson({error:"INVALID_INPUT"},400);
 if(message==="IDEMPOTENCY_KEY_REUSED")return attachmentJson({error:message},409);
 if(["INVALID_BRANCH","INVALID_CUSTOMER","INVALID_LEAD","INVALID_LINE_REFERENCE","INVALID_UNIT","QUOTATION_ATTACHMENT_REQUEST_KEY_REQUIRED"].includes(message))return attachmentJson({error:"INVALID_INPUT"},400);
 if(error instanceof QuotationAttachmentError)return attachmentJson({error:message},message==="QUOTATION_ATTACHMENT_CORRUPT"?503:["DRAFT_NOT_EDITABLE","QUOTATION_REVISION_CHANGED","IDEMPOTENCY_KEY_REUSED"].includes(message)?409:400);
 return attachmentJson({error:"ATTACHMENT_UNAVAILABLE"},503);
}
export function quotationAttachmentResponse(file:{data:Buffer;name:string;mimeType:string}){
 return new Response(new Uint8Array(file.data),{headers:{"Content-Type":file.mimeType,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
