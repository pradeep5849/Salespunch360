"use server";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {revalidatePath} from "next/cache";
import {accountAction} from "@/lib/account/action-feedback";
import {saveQuotationThemeForActor} from "@/lib/quotations/theme-settings";
export async function saveQuotationThemeAction(form:FormData){return accountAction(async()=>{
 const actor=await requirePermissionForMutation("ACCOUNT_SETTINGS"),id=String(form.get("id")??"");
 await saveQuotationThemeForActor(actor,id,{theme:form.get("theme"),color:form.get("color")});
 revalidatePath(`/workspace/account/quotations/${id}/preview`);
 return `/workspace/account/quotations/${id}/preview`;
},"Quotation theme saved");}
