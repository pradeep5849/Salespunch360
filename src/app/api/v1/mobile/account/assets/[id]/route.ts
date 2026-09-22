import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAssetDetail,
  mobileSaveAsset,
} from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileAssetDetail(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ASSET_DETAIL", e)
    );
  }
}
export async function PATCH(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileSaveAsset(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ASSET_UPDATE", e)
    );
  }
}
