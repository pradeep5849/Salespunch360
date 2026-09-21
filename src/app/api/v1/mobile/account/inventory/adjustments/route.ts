import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import {
  mobileAdjustment,
  mobileInventoryHistory,
} from "@/lib/mobile/account-inventory";
export async function GET(r: Request) {
  try {
    const u = await authenticateMobileToken(r.headers.get("authorization"));
    return mobileJson(await mobileInventoryHistory(u));
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_INVENTORY_LIST", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    const u = await authenticateMobileToken(r.headers.get("authorization"));
    return mobileJson(await mobileAdjustment(u, await r.json()), 201);
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_INVENTORY_WRITE", e)
    );
  }
}
