import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { listSaleAttachmentsForActor } from "@/lib/account/sale-attachments";
import { saleAttachmentFailure, saleAttachmentJson } from "@/lib/account/sale-attachment-http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = permit(await authenticateMobileToken(request.headers.get("authorization")), "ACCOUNT_LEDGER_VIEW");
    return saleAttachmentJson(await listSaleAttachmentsForActor(actor, (await context.params).id));
  } catch (error) { return saleAttachmentFailure(error); }
}
