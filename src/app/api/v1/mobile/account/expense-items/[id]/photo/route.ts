import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { expenseItemPhotoForActor } from "@/lib/account/expense-items";
import {
  mobileAuthorizationFailure,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = permit(
      await authenticateMobileToken(request.headers.get("authorization")),
      "ACCOUNT_EXPENSE_VIEW",
    );
    const data = await expenseItemPhotoForActor(
      actor,
      (await context.params).id,
    );
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_EXPENSE_ITEM_PHOTO", error)
    );
  }
}
