"use server";
import { redirect } from "next/navigation";
import { createQuotation, createQuotationRevision, createShare, revokeShare, transitionQuotation, updateQuotationDraft } from "@/lib/quotations/service";
export type QuotationActionState={error?:string;saved?:{id:string;number:string;documentType:string;intent:"NEW"|"PREVIEW"}};
function quotationPayload(form:FormData){const input=JSON.parse(String(form.get("document")));const customFields=Object.fromEntries(Array.from(form.entries()).filter(([key])=>key.startsWith("custom_")).map(([key,value])=>[key.slice(7),String(value)]));return Object.keys(customFields).length?{...input,customFields}:input}
const safe=(error:unknown)=>error instanceof Error&&error.message==="IDEMPOTENCY_KEY_REUSED"?"An earlier version of this draft was already saved. Open the saved documents before creating another.":error instanceof Error&&error.message.startsWith("CUSTOM_FIELDS_REQUIRED:")?"Complete the required custom fields.":error instanceof Error&&error.message.startsWith("INVALID_CUSTOM_FIELD:")?"Check the custom field values.":error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message.replaceAll("_"," "):"Unable to process quotation request";
const isRedirect=(error:unknown)=>Boolean(error&&typeof error==="object"&&"digest" in error);
export async function saveQuotation(_:QuotationActionState,form:FormData):Promise<QuotationActionState>{try{const document=await createQuotation({...quotationPayload(form),creationRequestKey:form.get("creationRequestKey")||undefined});const intent=form.get("saveIntent");if(intent==="NEW"||intent==="PREVIEW")return{saved:{id:document.id,number:document.documentNumber,documentType:document.documentType,intent}};redirect(`/workspace/account/quotations/${document.id}?saved=1`);}catch(error){if(isRedirect(error))throw error;return{error:safe(error)}}}
export async function saveRevision(id:string,_:QuotationActionState,form:FormData):Promise<QuotationActionState>{try{await createQuotationRevision(id,quotationPayload(form));redirect(`/workspace/account/quotations/${id}?revised=1`);}catch(error){if(isRedirect(error))throw error;return{error:safe(error)}}}
export async function updateDraft(id:string,_:QuotationActionState,form:FormData):Promise<QuotationActionState>{try{await updateQuotationDraft(id,quotationPayload(form));redirect(`/workspace/account/quotations/${id}?saved=1`);}catch(error){if(isRedirect(error))throw error;return{error:safe(error)}}}
export async function transitionQuotationAction(form:FormData){const id=String(form.get("id"));try{await transitionQuotation(id,String(form.get("to")) as never,String(form.get("note")??""));redirect(`/workspace/account/quotations/${id}?updated=1`);}catch(error){if(isRedirect(error))throw error;redirect(`/workspace/account/quotations/${id}?error=${encodeURIComponent(safe(error))}`)}}
export async function shareQuotationAction(form:FormData){const id=String(form.get("id"));try{const token=await createShare(id,form.get("expiresAt")?new Date(String(form.get("expiresAt"))):undefined);redirect(`/workspace/account/quotations/${id}?share=${encodeURIComponent(token)}`);}catch(error){if(isRedirect(error))throw error;redirect(`/workspace/account/quotations/${id}?error=${encodeURIComponent(safe(error))}`)}}
export async function revokeQuotationShareAction(form:FormData){const id=String(form.get("id"));try{await revokeShare(String(form.get("shareId")));redirect(`/workspace/account/quotations/${id}?revoked=1`);}catch(error){if(isRedirect(error))throw error;redirect(`/workspace/account/quotations/${id}?error=${encodeURIComponent(safe(error))}`)}}

export async function getQuotationPartyBalanceAction(raw:unknown){
 try{
  const {requirePermission}=await import("@/lib/auth/authorization");
  const {quotationPartyBalanceForActor}=await import("@/lib/quotations/party-balance");
  return {ok:true as const,...await quotationPartyBalanceForActor(await requirePermission("ACCOUNT_QUOTATION_VIEW") as import("@/lib/account/projects").ProjectActor,raw)};
 }catch{return {ok:false as const}};
}

export async function getQuotationItemCreationOptionsAction(){
 const {requirePermissionForMutation}=await import("@/lib/auth/authorization");
 await requirePermissionForMutation("ACCOUNT_QUOTATION_EDIT");
 const {addItemEditorOptions}=await import("@/lib/account/add-item-editor-options");
 return addItemEditorOptions();
}
export async function refreshQuotationEditorOptionsAction(){
 const {quotationEditorOptions}=await import("@/lib/quotations/service");return quotationEditorOptions();
}
