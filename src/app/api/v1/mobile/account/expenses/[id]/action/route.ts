import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileExpenseAction } from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileExpenseAction(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_ACTION", e)
    );
  }
}
