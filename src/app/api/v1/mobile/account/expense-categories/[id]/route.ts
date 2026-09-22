import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileDeactivateExpenseCategory,
  mobileSaveExpenseCategory,
} from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function PATCH(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileSaveExpenseCategory(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_CATEGORY_UPDATE", e)
    );
  }
}
export async function DELETE(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileDeactivateExpenseCategory(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_CATEGORY_DISABLE", e)
    );
  }
}
