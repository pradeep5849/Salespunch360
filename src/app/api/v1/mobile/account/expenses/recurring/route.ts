import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileRecurringExpense,
  mobileRecurringExpenseList,
} from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileRecurringExpense(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_RECURRING_EXPENSE", e)
    );
  }
}

export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileRecurringExpenseList(
        await authenticateMobileToken(r.headers.get("authorization")),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_RECURRING_EXPENSE_LIST", e)
    );
  }
}
