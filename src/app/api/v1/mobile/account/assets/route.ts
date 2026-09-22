import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAssets, mobileSaveAsset } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const x = new URL(r.url);
    return mobileJson(
      await mobileAssets(
        await authenticateMobileToken(r.headers.get("authorization")),
        x.searchParams.get("q"),
        x.searchParams.get("status"),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ASSETS", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileSaveAsset(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ASSET_CREATE", e)
    );
  }
}
