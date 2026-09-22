import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountDashboard } from "@/lib/mobile/account";
import { mobileAuthorizationFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return mobileJson(await mobileAccountDashboard(await authenticateMobileToken(request.headers.get("authorization")), {
      branchId: url.searchParams.get("branchId"), scope: url.searchParams.get("scope"),
    }));
  } catch (error) {
    return mobileUnauthorized(error) ?? mobileAuthorizationFailure(error) ?? mobileUnexpected("MOBILE_ACCOUNT_DASHBOARD", error);
  }
}
