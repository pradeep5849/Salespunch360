import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileSaveSettings } from "@/lib/mobile/account-administration";
import {mobileSaveInvoicePrintSettings} from "@/lib/mobile/invoice-print-settings";
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
    const user=await authenticateMobileToken(r.headers.get("authorization"));
    const raw=await r.json();
    return mobileJson(section==="invoice-print-settings"?await mobileSaveInvoicePrintSettings(user,raw):await mobileSaveSettings(user,section,raw));
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_SETTINGS_SAVE", e)
    );
  }
}
