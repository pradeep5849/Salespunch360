import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountHome } from "@/lib/mobile/account";
import { mobileAuthorizationFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return mobileJson(await mobileAccountHome(await authenticateMobileToken(request.headers.get("authorization")), {
      branchId: url.searchParams.get("branchId"), scope: url.searchParams.get("scope"),
      q: url.searchParams.get("q") ?? "", types: url.searchParams.getAll("type"),
    }));
  } catch (error) {
    return mobileUnauthorized(error) ?? mobileAuthorizationFailure(error) ?? mobileUnexpected("MOBILE_ACCOUNT_HOME", error);
  }
}
