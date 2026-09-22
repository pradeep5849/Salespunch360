import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileExpenseDetail,
  mobileUpdateExpense,
} from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileExpenseDetail(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_DETAIL", e)
    );
  }
}
export async function PATCH(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileUpdateExpense(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_UPDATE", e)
    );
  }
}
