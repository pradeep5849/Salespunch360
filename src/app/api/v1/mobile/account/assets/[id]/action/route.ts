import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAssetAction } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileAssetAction(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ASSET_ACTION", e)
    );
  }
}
