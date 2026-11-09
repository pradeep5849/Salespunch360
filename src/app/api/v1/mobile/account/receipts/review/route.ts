import { canUsePermission } from "@/lib/auth/permissions";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountActor } from "@/lib/mobile/account-transactions";
import { receiptEntryReviewForActor } from "@/lib/account/receipt-entry-review";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { z } from "zod";
export async function GET(r: Request) {
  try {
    const user = await authenticateMobileToken(r.headers.get("authorization")),
      query = new URL(r.url).searchParams;
    const actor = mobileAccountActor(user);
    if (
      !canUsePermission(actor, user.productEdition, "ACCOUNT_SETTLEMENT_ENTRY")
    )
      throw new Error("MOBILE_FORBIDDEN");
    return mobileJson(
      await receiptEntryReviewForActor(actor, {
        branchId: query.get("branchId"),
        ...(query.get("customerId")
          ? { customerId: query.get("customerId") }
          : {}),
      }),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      (e instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
      mobileUnexpected("RECEIPT_REVIEW", e)
    );
  }
}
