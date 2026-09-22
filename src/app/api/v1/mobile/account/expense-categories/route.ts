import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileExpenseCategories,
  mobileSaveExpenseCategory,
} from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const x = new URL(r.url);
    return mobileJson(
      await mobileExpenseCategories(
        await authenticateMobileToken(r.headers.get("authorization")),
        x.searchParams.get("q"),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_CATEGORIES", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileSaveExpenseCategory(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_CATEGORY_CREATE", e)
    );
  }
}
