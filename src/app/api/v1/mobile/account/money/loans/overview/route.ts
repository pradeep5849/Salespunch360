import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileLoanOverview } from "@/lib/mobile/account-money";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileLoanOverview(
        await authenticateMobileToken(r.headers.get("authorization")),
        Object.fromEntries(new URL(r.url).searchParams),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_LOAN_OVERVIEW", e)
    );
  }
}
