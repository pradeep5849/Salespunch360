import {AuthorizationError,requirePermissionForMutation} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {appendSaleAttachmentsForActor} from "@/lib/account/sale-attachments";
import {saleAppendAttachmentForm,saleAttachmentFailure,saleAttachmentJson} from "@/lib/account/sale-attachment-http";
import {revalidatePath} from "next/cache";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const actor=await requirePermissionForMutation("ACCOUNT_JOURNAL_POST");if(!actor.companyId)throw new AuthorizationError();
  await mutationGuard("sale-attachment-append");
  const form=await saleAppendAttachmentForm(request);
  const id=(await context.params).id;
  const attachments=await appendSaleAttachmentsForActor({...actor,companyId:actor.companyId},id,form.requestKey,form.files);
  revalidatePath(`/workspace/account/sales/${id.toLowerCase()}`);revalidatePath(`/workspace/account/sales/${id.toLowerCase()}/edit`);
  return saleAttachmentJson({ok:true,attachments},201);
 }catch(error){return saleAttachmentFailure(error)}
}
