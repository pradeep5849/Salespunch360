import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileUtilities } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  try {
    const { kind } = await params;
    return mobileJson(
      await mobileUtilities(
        await authenticateMobileToken(r.headers.get("authorization")),
        kind,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_UTILITIES", e)
    );
  }
}
