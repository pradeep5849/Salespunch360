import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { mobileLowStock } from "@/lib/mobile/account-inventory";
export async function GET(r: Request) {
  try {
    const u = await authenticateMobileToken(r.headers.get("authorization"));
    return mobileJson(await mobileLowStock(u));
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_INVENTORY", e)
    );
  }
}
