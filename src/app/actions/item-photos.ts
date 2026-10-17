"use server";
import {requirePermissionForMutation,AuthorizationError} from "@/lib/auth/authorization";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {saveItemPhotoForActor} from "@/lib/account/item-photos";
import {accountErrorMessage} from "@/lib/account/action-feedback";
export async function saveItemPhotoAction(kind:"products"|"services",id:string,form:FormData){
 try{
  const actor=await requirePermissionForMutation("ACCOUNT_STOCK");if(!actor.companyId)throw new AuthorizationError();await assertOperationalWrite(actor.companyId);
  const file=form.get("photo");if(!(file instanceof File))throw new Error("INVALID_ITEM_PHOTO");
  return {ok:true as const,...await saveItemPhotoForActor({...actor,companyId:actor.companyId},{kind,id},file)};
 }catch(error){return {ok:false as const,message:error instanceof Error&&error.message==="INVALID_ITEM_PHOTO"?"Choose a readable image up to 5 MB.":accountErrorMessage(error)}}
}
