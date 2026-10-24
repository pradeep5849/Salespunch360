import {saveBackupSettings} from "@/lib/account/backup-settings";
import {saveTransactionDefaults} from "@/lib/account/transaction-defaults";
import {canUsePermission} from "@/lib/auth/permissions";
import {saveTransactionMessaging} from "@/lib/account/transaction-messaging";
import {saveBusinessCurrency} from "@/lib/account/business-currency";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
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
    if(["transaction-messaging","business-currency","backup-settings","transaction-defaults"].includes(section)){
      const actor=mobileAccountActor(user);if(!canUsePermission(actor,user.productEdition,"ACCOUNT_SETTINGS"))throw new Error("MOBILE_FORBIDDEN");await assertOperationalWrite(actor.companyId);
      return mobileJson(section==="transaction-messaging"?await saveTransactionMessaging(actor,raw):section==="backup-settings"?await saveBackupSettings(actor,raw):section==="transaction-defaults"?await saveTransactionDefaults(actor,raw):await saveBusinessCurrency(actor,raw.baseCurrency));
    }
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
