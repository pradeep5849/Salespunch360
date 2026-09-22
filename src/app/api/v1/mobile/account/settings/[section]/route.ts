import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileSaveSettings } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  try {
    const { section } = await params;
    return mobileJson(
      await mobileSaveSettings(
        await authenticateMobileToken(r.headers.get("authorization")),
        section,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_SETTINGS_SAVE", e)
    );
  }
}
