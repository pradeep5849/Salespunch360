import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileMoneyContext } from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileMoneyContext(
        await authenticateMobileToken(r.headers.get("authorization")),
        Object.fromEntries(new URL(r.url).searchParams),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_MONEY", e)
    );
  }
}
