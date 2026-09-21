import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileCreateExpense,
  mobileExpenseList,
} from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const u = new URL(r.url);
    return mobileJson(
      await mobileExpenseList(
        await authenticateMobileToken(r.headers.get("authorization")),
        u.searchParams.get("q"),
        u.searchParams.get("status"),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_LIST", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileCreateExpense(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      (e instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
      mobileUnexpected("MOBILE_EXPENSE_CREATE", e)
    );
  }
}
