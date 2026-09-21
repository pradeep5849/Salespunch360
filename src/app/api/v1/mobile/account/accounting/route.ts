import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountingOverview } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileAccountingOverview(
        await authenticateMobileToken(r.headers.get("authorization")),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNTING", e)
    );
  }
}
