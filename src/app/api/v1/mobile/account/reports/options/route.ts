import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountReportOptions } from "@/lib/mobile/account-reports";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileAccountReportOptions(
        await authenticateMobileToken(r.headers.get("authorization")),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_REPORT_OPTIONS", e)
    );
  }
}
