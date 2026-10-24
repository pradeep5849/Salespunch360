import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { appendSaleAttachmentsForActor,listSaleAttachmentsForActor } from "@/lib/account/sale-attachments";
import { saleAppendAttachmentForm,saleAttachmentFailure, saleAttachmentJson } from "@/lib/account/sale-attachment-http";
import {assertOperationalWrite} from "@/lib/billing/entitlement";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = permit(await authenticateMobileToken(request.headers.get("authorization")), "ACCOUNT_LEDGER_VIEW");
    return saleAttachmentJson(await listSaleAttachmentsForActor(actor, (await context.params).id));
  } catch (error) { return saleAttachmentFailure(error); }
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_JOURNAL_POST");
    await assertOperationalWrite(actor.companyId);
    const form=await saleAppendAttachmentForm(request);
    return saleAttachmentJson({ok:true,attachments:await appendSaleAttachmentsForActor(actor,(await context.params).id,form.requestKey,form.files)},201);
  }catch(error){return saleAttachmentFailure(error)}
}
