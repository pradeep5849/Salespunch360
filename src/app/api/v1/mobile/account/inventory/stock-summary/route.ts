import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { mobileStockSummary } from "@/lib/mobile/account-inventory";
export async function GET(request: Request) {
  try {
    const user = await authenticateMobileToken(
      request.headers.get("authorization"),
    );
    return mobileJson(
      await mobileStockSummary(
        user,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_STOCK_SUMMARY", error)
    );
  }
}
