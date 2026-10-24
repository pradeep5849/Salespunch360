import { AuthorizationError, requirePermissionForMutation } from "@/lib/auth/authorization";
import { mutationGuard } from "@/lib/security/request";
import { submitSaleForActor } from "@/lib/account/sale-submit";
import { saleAttachmentFailure, saleAttachmentJson, saleCreationAttachmentForm } from "@/lib/account/sale-attachment-http";

export async function POST(request: Request) {
  try {
    const actor = await requirePermissionForMutation("ACCOUNT_JOURNAL_POST");
    if (!actor.companyId) throw new AuthorizationError();
    await mutationGuard("sale-create");
    const form = await saleCreationAttachmentForm(request);
    const row = await submitSaleForActor({ ...actor, companyId: actor.companyId }, form.document, form.payment, "sale-save-receipt", form.files);
    return saleAttachmentJson({ ok: true, id: row.id, documentNumber: row.documentNumber }, 201);
  } catch (error) { return saleAttachmentFailure(error); }
}
