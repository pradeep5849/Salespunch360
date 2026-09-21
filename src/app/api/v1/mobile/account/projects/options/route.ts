import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileProjectOptions } from "@/lib/mobile/account-projects";
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
      await mobileProjectOptions(
        await authenticateMobileToken(r.headers.get("authorization")),
        x.searchParams.get("id") ?? undefined,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_PROJECT_OPTIONS", e)
    );
  }
}
