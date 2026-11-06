import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountActor } from "@/lib/mobile/account-transactions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import { submitPaymentForActor } from "@/lib/account/payment-submission";
import {
  paymentEvidenceForm,
  paymentEvidenceFailure,
} from "@/lib/account/payment-evidence-http";
export async function POST(request: Request) {
  try {
    const actor = mobileAccountActor(
      await authenticateMobileToken(request.headers.get("authorization")),
    );
    await assertOperationalWrite(actor.companyId);
    const { input, files } = await paymentEvidenceForm(request);
    return Response.json(await submitPaymentForActor(actor, input, files), {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return paymentEvidenceFailure(error);
  }
}
