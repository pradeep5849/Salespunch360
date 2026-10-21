import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { downloadSaleAttachmentForActor } from "@/lib/account/sale-attachments";
import { saleAttachmentFailure, saleAttachmentResponse } from "@/lib/account/sale-attachment-http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = permit(await authenticateMobileToken(request.headers.get("authorization")), "ACCOUNT_LEDGER_VIEW");
    return saleAttachmentResponse(await downloadSaleAttachmentForActor(actor, (await context.params).id));
  } catch (error) { return saleAttachmentFailure(error); }
}
