import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileCreateMoneyAccount } from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileCreateMoneyAccount(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_MONEY_ACCOUNT", e)
    );
  }
}
