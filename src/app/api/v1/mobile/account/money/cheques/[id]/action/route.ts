import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileChequeFinancialAction } from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return mobileJson(
      await mobileChequeFinancialAction(
        await authenticateMobileToken(request.headers.get("authorization")),
        id,
        await request.json(),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_CHEQUE_FINANCIAL_ACTION", error)
    );
  }
}
