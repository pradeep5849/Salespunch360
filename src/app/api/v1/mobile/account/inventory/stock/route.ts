import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { mobileStock } from "@/lib/mobile/account-inventory";
export async function GET(r: Request) {
  try {
    const u = await authenticateMobileToken(r.headers.get("authorization"));
    const q = new URL(r.url).searchParams;
    return mobileJson(
      await mobileStock(u, {
        branchId: q.get("branchId"),
        scope: q.get("scope"),
        asOf: q.get("asOf"),
      }),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_INVENTORY", e)
    );
  }
}
