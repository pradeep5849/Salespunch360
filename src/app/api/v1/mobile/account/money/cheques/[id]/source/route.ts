import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileCompleteLegacyChequeSource } from "@/lib/mobile/account-money";
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
    return mobileJson(
      await mobileCompleteLegacyChequeSource(
        await authenticateMobileToken(request.headers.get("authorization")),
        (await context.params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_CHEQUE_SOURCE_COMPLETION", error)
    );
  }
}
