import {z} from "zod";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {AuthorizationError} from "@/lib/auth/authorization";
import {updateSettingsSectionForActor} from "@/lib/account/settings-persistence";
import {getCustomerQuotationForActor} from "./service";
import {quotationThemeSchema} from "./theme-catalogue";
export async function saveQuotationThemeForActor(actor:Parameters<typeof getCustomerQuotationForActor>[0],id:string,raw:unknown){
 if(actor.accountRole!=="ACCOUNT_ADMIN"||!actor.companyId)throw new AuthorizationError();
 const value=quotationThemeSchema.parse(raw);z.string().guid().parse(id);
 await assertOperationalWrite(actor.companyId);
 await getCustomerQuotationForActor(actor,id);
 await updateSettingsSectionForActor(actor,"quotationPrintTheme",value);
 return value;
}
