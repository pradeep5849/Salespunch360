import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileChequePage } from "@/lib/mobile/account-money";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = Object.fromEntries(
      [
        "q",
        "tab",
        "status",
        "branchId",
        "scope",
        "order",
        "offset",
        "limit",
      ].flatMap((key) => {
        const value = url.searchParams.get(key);
        return value ? [[key, value]] : [];
      }),
    );
    return mobileJson(
      await mobileChequePage(
        await authenticateMobileToken(request.headers.get("authorization")),
        query,
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      (error instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
      mobileUnexpected("MOBILE_CHEQUE_LIST", error)
    );
  }
}
