import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountActor } from "@/lib/mobile/account-transactions";
import { downloadPaymentAttachmentForActor } from "@/lib/account/payment-submission";
import {
  paymentEvidenceFailure,
  paymentEvidenceResponse,
} from "@/lib/account/payment-evidence-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = mobileAccountActor(
      await authenticateMobileToken(request.headers.get("authorization")),
    );
    return paymentEvidenceResponse(
      await downloadPaymentAttachmentForActor(actor, (await params).id),
    );
  } catch (error) {
    return paymentEvidenceFailure(error);
  }
}
