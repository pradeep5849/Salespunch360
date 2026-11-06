import {saveReminderSettingsForActor} from "@/lib/account/reminder-settings";
import {saveTaxPreferences} from "@/lib/account/tax-preferences";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {mobileAccountActor} from "./account-transactions";
import type {MobileAppPrincipal} from "./auth";

const admin=(u:MobileAppPrincipal)=>{const a=mobileAccountActor(u);if(!canUsePermission(a,u.productEdition,"ACCOUNT_SETTINGS")||a.accountRole!=="ACCOUNT_ADMIN")throw new Error("MOBILE_FORBIDDEN");return a};
export async function mobileSaveReferenceSettings(u:MobileAppPrincipal,section:"reminders"|"tax-preferences",raw:unknown){
 const a=admin(u);await assertOperationalWrite(a.companyId);
 return section==="reminders"?saveReminderSettingsForActor(a,raw):saveTaxPreferences(a,raw);
}
