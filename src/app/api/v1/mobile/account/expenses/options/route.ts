import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileExpenseOptions } from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileExpenseOptions(
        await authenticateMobileToken(r.headers.get("authorization")),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_OPTIONS", e)
    );
  }
}
