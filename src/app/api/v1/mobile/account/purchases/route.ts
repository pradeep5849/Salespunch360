import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileCreatePurchase,
  mobilePurchasePage,
} from "@/lib/mobile/account-purchases";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const u = new URL(r.url);
    const page = await mobilePurchasePage(
      await authenticateMobileToken(r.headers.get("authorization")),
      u.searchParams.get("type"),
      u.searchParams.get("q"),
      u.searchParams.get("cursor"),
      u.searchParams.get("branchId"),
    );
    return mobileJson(u.searchParams.get("page") === "1" ? page : page.rows);
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      (e instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
      mobileUnexpected("MOBILE_PURCHASE_LIST", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileCreatePurchase(
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
      mobileUnexpected("MOBILE_PURCHASE_CREATE", e)
    );
  }
}
