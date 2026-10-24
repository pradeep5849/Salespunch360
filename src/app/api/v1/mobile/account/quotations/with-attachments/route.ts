import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileCreateQuotation} from "@/lib/mobile/account-quotations";
import {attachmentJson,quotationAttachmentFailure,quotationCreationForm} from "@/lib/quotations/attachment-http";
export async function POST(request:Request){
 try{
  const actor=await authenticateMobileToken(request.headers.get("authorization")),form=await quotationCreationForm(request);
  return attachmentJson(await mobileCreateQuotation(actor,form.document,form.files),201);
 }catch(error){return quotationAttachmentFailure(error)}
}
