import { AuthorizationError, requirePermission } from "@/lib/auth/authorization";
import { downloadSaleAttachmentForActor } from "@/lib/account/sale-attachments";
import { saleAttachmentFailure, saleAttachmentResponse } from "@/lib/account/sale-attachment-http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("ACCOUNT_LEDGER_VIEW");
    if (!actor.companyId) throw new AuthorizationError();
    return saleAttachmentResponse(await downloadSaleAttachmentForActor({ ...actor, companyId: actor.companyId }, (await context.params).id));
  } catch (error) { return saleAttachmentFailure(error); }
}
