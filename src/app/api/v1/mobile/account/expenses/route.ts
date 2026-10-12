import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileCreateExpense,
  mobileExpensePage,
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
    const query = Object.fromEntries(
      [
        "q",
        "status",
        "type",
        "categoryId",
        "templateId",
        "branchId",
        "scope",
        "offset",
        "limit",
      ].flatMap((key) => {
        const value = u.searchParams.get(key);
        return value ? [[key, value]] : [];
      }),
    );
    const data = await mobileExpensePage(
      await authenticateMobileToken(r.headers.get("authorization")),
      query,
    );
    return mobileJson(u.searchParams.get("page") === "1" ? data : data.rows);
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      (e instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
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
