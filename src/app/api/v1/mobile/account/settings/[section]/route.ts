import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileSaveSettings } from "@/lib/mobile/account-administration";
import {mobileSaveInvoicePrintSettings} from "@/lib/mobile/invoice-print-settings";
import {mobileSaveReferenceSettings} from "@/lib/mobile/reference-settings";
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
    if(section==="invoice-print-settings")return mobileJson(await mobileSaveInvoicePrintSettings(user,raw));
    if(section==="reminders"||section==="tax-preferences")return mobileJson(await mobileSaveReferenceSettings(user,section,raw));
    return mobileJson(await mobileSaveSettings(user,section,raw));
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_SETTINGS_SAVE", e)
    );
  }
}
