import {assertOperationalWrite} from "@/lib/billing/entitlement";
import type {MobileAppPrincipal} from "./auth";

import { invoicePrintSettingsSchema } from "@/lib/account/invoice-print-settings";
import { updateSettingsSectionForActor } from "@/lib/account/settings-persistence";
import { mobileAccountActor } from "./account-transactions";

export async function mobileSaveInvoicePrintSettings(user:MobileAppPrincipal,raw:unknown){
 if(!user.authorizedWorkspaces.includes("ACCOUNT")||user.accountRole!=="ACCOUNT_ADMIN")throw new Error("MOBILE_FORBIDDEN");
 await assertOperationalWrite(user.companyId);
 return updateSettingsSectionForActor(mobileAccountActor(user), "invoicePrintSettings", invoicePrintSettingsSchema.parse(raw));
}
