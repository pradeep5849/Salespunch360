import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileEditLoanMetadata } from "@/lib/mobile/account-money";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function PATCH(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileEditLoanMetadata(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_LOAN_METADATA", e)
    );
  }
}
