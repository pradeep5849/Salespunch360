import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import {
  mobileCreateInventoryCatalog,
  mobileInventoryCatalog,
} from "@/lib/mobile/account-inventory";
export async function GET(r: Request) {
  try {
    const u = await authenticateMobileToken(r.headers.get("authorization"));
    return mobileJson(await mobileInventoryCatalog(u, "serials"));
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_INVENTORY", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    const u = await authenticateMobileToken(r.headers.get("authorization"));
    return mobileJson(
      await mobileCreateInventoryCatalog(u, "serials", await r.json()),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_INVENTORY_CATALOG_WRITE", e)
    );
  }
}
