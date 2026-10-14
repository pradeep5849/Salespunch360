import {revalidatePath} from "next/cache";
import {AccountPageHeader} from "@/components/account/account-shell";
import {SaveFeedbackForm,SaveSubmitButton,SavePendingFields} from "@/components/account/save-feedback";
import {getAccountSettings} from "@/lib/account/settings";
import {saveBusinessCurrency} from "@/lib/account/business-currency";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
export default async function Page(){
 const settings=await getAccountSettings();
 async function save(fd:FormData){"use server";try{await saveBusinessCurrency(await requirePermissionForMutation("ACCOUNT_SETTINGS"),fd.get("baseCurrency"));}catch(error){if(error instanceof Error&&error.message==="BUSINESS_CURRENCY_LOCKED")return {saveError:error.message};throw error;}revalidatePath("/workspace/account","layout")}
 return <><AccountPageHeader title="Multi-Currency" backHref="/workspace/account/settings"/><SaveFeedbackForm action={save} errorMessages={{BUSINESS_CURRENCY_LOCKED:"Business currency cannot be changed after accounting entries have been posted."}}><SavePendingFields><div className="general-settings-row"><label htmlFor="currency">Business Currency</label><select id="currency" name="baseCurrency" defaultValue={settings?.baseCurrency??"INR"}>{["INR","USD","EUR","GBP","AED"].map(x=><option key={x}>{x}</option>)}</select></div></SavePendingFields><p>The business currency applies to amounts throughout the account. It can be changed before accounting entries are posted.</p><SaveSubmitButton>Save</SaveSubmitButton></SaveFeedbackForm></>;
}
