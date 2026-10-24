import {authenticateMobileToken} from "@/lib/mobile/auth";
import {permit} from "@/lib/mobile/account-transactions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {replacePostedSaleForActor} from "@/lib/account/sale-amendments";
import {saleAttachmentFailure,saleAttachmentJson,saleCreationAttachmentForm} from "@/lib/account/sale-attachment-http";
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_JOURNAL_POST");
  await assertOperationalWrite(actor.companyId);
  const form=await saleCreationAttachmentForm(request);
  if(Object.keys(form.payment).length)throw new Error("INVALID_INPUT");
  const row=await replacePostedSaleForActor(actor,(await context.params).id,form.document,form.files);
  return saleAttachmentJson({ok:true,id:row.id,documentNumber:row.documentNumber,status:row.status});
 }catch(error){return saleAttachmentFailure(error)}
}
