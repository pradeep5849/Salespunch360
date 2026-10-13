import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileMoneyAccountHistory } from "@/lib/mobile/account-money";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileMoneyAccountHistory(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        Object.fromEntries(new URL(r.url).searchParams),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_MONEY_ACCOUNT_HISTORY", e)
    );
  }
}
