import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileFinancialYearClosePreview } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(request: Request) {
  try {
    return mobileJson(
      await mobileFinancialYearClosePreview(
        await authenticateMobileToken(request.headers.get("authorization")),
        new URL(request.url).searchParams.get("financialYearId") ?? "",
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_YEAR_CLOSE_PREVIEW", error)
    );
  }
}
