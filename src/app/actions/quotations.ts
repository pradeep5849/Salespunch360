"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createQuotation, createQuotationRevision, createShare, revokeShare, transitionQuotation, updateQuotationDraft } from "@/lib/quotations/service";
export type QuotationActionState={error?:string};
const safe=(e:unknown)=>e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message.replaceAll("_"," "):"Please check the quotation data and try again";
export async function saveQuotation(_:QuotationActionState,form:FormData):Promise<QuotationActionState>{try{const d=JSON.parse(String(form.get("document")));const doc=await createQuotation(d);redirect(`/workspace/account/quotations/${doc.id}?saved=1`);}catch(e){if(e&&typeof e==="object"&&"digest" in e)throw e;return {error:safe(e)};}}
export async function saveRevision(id:string,_:QuotationActionState,form:FormData):Promise<QuotationActionState>{try{await createQuotationRevision(id,JSON.parse(String(form.get("document"))));redirect(`/workspace/account/quotations/${id}?revised=1`);}catch(e){if(e&&typeof e==="object"&&"digest" in e)throw e;return {error:safe(e)};}}
export async function updateDraft(id:string,_:QuotationActionState,form:FormData):Promise<QuotationActionState>{try{await updateQuotationDraft(id,JSON.parse(String(form.get("document"))));redirect(`/workspace/account/quotations/${id}?saved=1`);}catch(e){if(e&&typeof e==="object"&&"digest" in e)throw e;return {error:safe(e)};}}
export async function transitionQuotationAction(form:FormData){const id=String(form.get("id")),to=String(form.get("to")) as never;await transitionQuotation(id,to,String(form.get("note")??""));revalidatePath(`/workspace/account/quotations/${id}`);}
export async function shareQuotationAction(form:FormData){const id=String(form.get("id"));const token=await createShare(id,form.get("expiresAt")?new Date(String(form.get("expiresAt"))):undefined);redirect(`/workspace/account/quotations/${id}?share=${encodeURIComponent(token)}`);}
export async function revokeQuotationShareAction(form:FormData){await revokeShare(String(form.get("shareId")));revalidatePath(`/workspace/account/quotations/${String(form.get("id"))}`);}
