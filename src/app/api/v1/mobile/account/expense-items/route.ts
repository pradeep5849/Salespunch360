import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  createExpenseItemForActor,
  listExpenseItemsForActor,
} from "@/lib/account/expense-items";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(request: Request) {
  try {
    const actor = permit(
      await authenticateMobileToken(request.headers.get("authorization")),
      "ACCOUNT_EXPENSE_VIEW",
    );
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return mobileJson(await listExpenseItemsForActor(actor, query));
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_EXPENSE_ITEMS", error)
    );
  }
}
export async function POST(request: Request) {
  try {
    const actor = permit(
      await authenticateMobileToken(request.headers.get("authorization")),
      "ACCOUNT_EXPENSE_ENTRY",
    );
    await assertOperationalWrite(actor.companyId);
    if (Number(request.headers.get("content-length")) > 5 * 1024 * 1024 + 65536)
      return mobileJson({ error: "INVALID_EXPENSE_ITEM_PHOTO" }, 413);
    const form = await request.formData();
    const photo = form.get("photo");
    return mobileJson(
      await createExpenseItemForActor(
        actor,
        { name: form.get("name"), requestKey: form.get("requestKey") },
        photo instanceof File ? photo : null,
      ),
      201,
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_EXPENSE_ITEM_CREATE", error)
    );
  }
}
