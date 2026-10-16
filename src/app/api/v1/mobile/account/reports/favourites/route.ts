import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileSetReportFavourite } from "@/lib/mobile/account-reports";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(request: Request) {
  try {
    return mobileJson(
      await mobileSetReportFavourite(
        await authenticateMobileToken(request.headers.get("authorization")),
        await request.json(),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_REPORT_FAVOURITE", error)
    );
  }
}
