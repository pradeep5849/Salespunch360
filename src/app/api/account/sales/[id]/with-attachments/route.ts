import {AuthorizationError,requirePermissionForMutation} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {replacePostedSaleForActor} from "@/lib/account/sale-amendments";
import {saleAttachmentFailure,saleAttachmentJson,saleCreationAttachmentForm} from "@/lib/account/sale-attachment-http";
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const actor=await requirePermissionForMutation("ACCOUNT_JOURNAL_POST");if(!actor.companyId)throw new AuthorizationError();
  await mutationGuard("sale-correction-files");
  const form=await saleCreationAttachmentForm(request);
  if(Object.keys(form.payment).length)throw new Error("INVALID_INPUT");
  const row=await replacePostedSaleForActor({...actor,companyId:actor.companyId},(await context.params).id,form.document,form.files);
  return saleAttachmentJson({ok:true,id:row.id,documentNumber:row.documentNumber});
 }catch(error){return saleAttachmentFailure(error)}
}
