import { requirePermission } from "@/lib/auth/authorization";
import { downloadPaymentAttachmentForActor } from "@/lib/account/payment-submission";
import {
  paymentEvidenceFailure,
  paymentEvidenceResponse,
} from "@/lib/account/payment-evidence-http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("ACCOUNT_LEDGER_VIEW");
    return paymentEvidenceResponse(
      await downloadPaymentAttachmentForActor(
        { ...actor, companyId: actor.companyId! },
        (await params).id,
      ),
    );
  } catch (error) {
    return paymentEvidenceFailure(error);
  }
}
