import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import { submitSaleForActor } from "@/lib/account/sale-submit";
import { saleAttachmentFailure, saleAttachmentJson, saleCreationAttachmentForm } from "@/lib/account/sale-attachment-http";

export async function POST(request: Request) {
  try {
    const actor = permit(await authenticateMobileToken(request.headers.get("authorization")), "ACCOUNT_JOURNAL_POST");
    await assertOperationalWrite(actor.companyId);
    const form = await saleCreationAttachmentForm(request);
    return saleAttachmentJson(await submitSaleForActor(actor, form.document, form.payment, "mobile-sale-receipt", form.files), 201);
  } catch (error) { return saleAttachmentFailure(error); }
}
