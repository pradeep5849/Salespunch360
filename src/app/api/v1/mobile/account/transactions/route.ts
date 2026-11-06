import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileCreateSales,
  mobileSalesPage,
} from "@/lib/mobile/account-transactions";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
const failure = (e: unknown) =>
  e instanceof z.ZodError ||
  (e instanceof Error && e.message === "INVALID_INPUT")
    ? mobileJson({ error: "INVALID_INPUT" }, 400)
    : null;
export async function GET(r: Request) {
  try {
    const u = new URL(r.url);
    const page = await mobileSalesPage(
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
      failure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_SALES_LIST", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileCreateSales(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      failure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_SALES_CREATE", e)
    );
  }
}
