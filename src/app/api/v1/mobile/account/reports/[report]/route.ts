import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountReport } from "@/lib/mobile/account-reports";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(
  r: Request,
  c: { params: Promise<{ report: string }> },
) {
  try {
    const u = new URL(r.url);
    return mobileJson(
      await mobileAccountReport(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).report,
        Object.fromEntries(u.searchParams),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_REPORT", e)
    );
  }
}
