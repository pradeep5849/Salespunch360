"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthorizationError, requirePermissionForMutation } from "@/lib/auth/authorization";
import { replacePostedSaleForActor, reversePostedSaleForActor } from "@/lib/account/sale-amendments";
async function amendmentActor(){await requirePermissionForMutation("ACCOUNT_SALES_ENTRY");const actor=await requirePermissionForMutation("ACCOUNT_JOURNAL_POST");if(!actor.companyId)throw new AuthorizationError();return {...actor,companyId:actor.companyId}}
export async function deletePostedSaleAction(form:FormData){
 await reversePostedSaleForActor(await amendmentActor(),String(form.get("id")||""));
 revalidatePath("/workspace/account");revalidatePath("/workspace/account/transactions");redirect("/workspace/account");
}
export async function replacePostedSaleAction(sourceId:string,raw:unknown){
 const replacement=await replacePostedSaleForActor(await amendmentActor(),sourceId,raw);
 revalidatePath("/workspace/account");revalidatePath("/workspace/account/transactions");
 return {id:replacement.id,documentNumber:replacement.documentNumber};
}
