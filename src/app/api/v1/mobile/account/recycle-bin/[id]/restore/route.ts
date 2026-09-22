import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileRecycleRestore } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileRecycleRestore(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_RECYCLE_RESTORE", e)
    );
  }
}
