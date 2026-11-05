import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountActor } from "@/lib/mobile/account-transactions";
import { homeSettlementForActor } from "@/lib/account/home-settlement";
import { paymentDuplicateForActor } from "@/lib/account/payment-duplicate";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { z } from "zod";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = mobileAccountActor(
        await authenticateMobileToken(request.headers.get("authorization")),
      ),
      { id } = await params;
    if (!z.string().uuid().safeParse(id).success)
      return mobileJson({ error: "INVALID_INPUT" }, 400);
    if (new URL(request.url).searchParams.get("duplicate") === "1")
      return mobileJson(await paymentDuplicateForActor(actor, id));
    const data = await homeSettlementForActor(actor, id);
    if (!data) return mobileJson({ error: "NOT_FOUND" }, 404);
    return mobileJson({
      ...data,
      canDuplicate:
        ["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(actor.accountRole ?? "") &&
        data.paymentMode !== "ACCOUNT_CREDIT",
    });
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_SETTLEMENT_DETAIL", error)
    );
  }
}
