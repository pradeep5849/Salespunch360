import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileOwnerSetup } from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileOwnerSetup(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_OWNER_SETUP", e)
    );
  }
}
