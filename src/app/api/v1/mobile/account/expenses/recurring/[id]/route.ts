import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileRecurringExpenseAction } from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return mobileJson(
      await mobileRecurringExpenseAction(
        await authenticateMobileToken(request.headers.get("authorization")),
        id,
        await request.json(),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_RECURRING_EXPENSE_ACTION", error)
    );
  }
}
