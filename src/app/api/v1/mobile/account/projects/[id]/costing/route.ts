import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileProjectCosting } from "@/lib/mobile/account-projects";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileProjectCosting(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_PROJECT_COSTING", e)
    );
  }
}
