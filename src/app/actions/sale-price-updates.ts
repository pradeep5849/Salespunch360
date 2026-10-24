"use server";
import { revalidatePath } from "next/cache";
import { AuthorizationError, requirePermissionForMutation } from "@/lib/auth/authorization";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import { salePriceProposalsForActor, confirmSalePriceForActor } from "@/lib/account/sale-price-updates";
import { accountErrorMessage } from "@/lib/account/action-feedback";
async function actor(){const value=await requirePermissionForMutation("ACCOUNT_STOCK");if(!value.companyId)throw new AuthorizationError();return {...value,companyId:value.companyId};}
export async function salePriceProposalsAction(documentId:string){
 try{return {ok:true as const,proposals:await salePriceProposalsForActor(await actor(),documentId)};}
 catch(error){if(error instanceof AuthorizationError)return {ok:true as const,proposals:[]};return {ok:false as const,message:accountErrorMessage(error)};}
}
export async function confirmSalePriceAction(raw:unknown){
 try{const current=await actor();await assertOperationalWrite(current.companyId);await confirmSalePriceForActor(current,raw);revalidatePath("/workspace/account/inventory");return {ok:true as const};}
 catch(error){return {ok:false as const,message:accountErrorMessage(error)};}
}
