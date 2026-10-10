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
    const page = await mobileAssets(
      await authenticateMobileToken(r.headers.get("authorization")),
      x.searchParams.get("q"),
      x.searchParams.get("status"),
      Number(x.searchParams.get("offset") ?? 0),
      Number(x.searchParams.get("limit") ?? 50),
    );
    const response = mobileJson(
      x.searchParams.get("paged") === "1" ? page : page.items,
    );
    response.headers.set("X-Has-More", String(page.hasMore));
    return response;
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
