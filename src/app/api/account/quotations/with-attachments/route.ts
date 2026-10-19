import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {createQuotationForActor} from "@/lib/quotations/service";
import {attachmentJson,quotationAttachmentFailure,quotationCreationForm} from "@/lib/quotations/attachment-http";
export async function POST(request:Request){
 try{
  const actor=await requirePermissionForMutation("ACCOUNT_QUOTATION_EDIT");await mutationGuard("quotation-create");
  const form=await quotationCreationForm(request);
  return attachmentJson(await createQuotationForActor(actor,form.document,form.files),201);
 }catch(error){return quotationAttachmentFailure(error)}
}
