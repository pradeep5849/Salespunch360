import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileFinancialYearClose } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileFinancialYearClose(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_FINANCIAL_YEAR_CLOSE", e)
    );
  }
}
