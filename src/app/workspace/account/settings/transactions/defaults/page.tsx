import {revalidatePath} from "next/cache";
import {AccountPageHeader} from "@/components/account/account-shell";
import {SaveFeedbackForm,SaveSubmitButton,SavePendingFields} from "@/components/account/save-feedback";
import {getAccountSettings} from "@/lib/account/settings";
import {saveTransactionDefaults} from "@/lib/account/transaction-defaults";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
export default async function Page(){
 const settings=await getAccountSettings(),values=(settings?.transactionDefaults??{}) as Record<string,unknown>;
 async function save(fd:FormData){"use server";await saveTransactionDefaults(await requirePermissionForMutation("ACCOUNT_SETTINGS"),{defaultDueDays:Number(fd.get("defaultDueDays")),salesTerms:String(fd.get("salesTerms")??""),purchaseTerms:String(fd.get("purchaseTerms")??""),projectTerms:String(fd.get("projectTerms")??"")});revalidatePath("/workspace/account/settings/transactions")}
 return <><AccountPageHeader title="Due Dates & Terms" backHref="/workspace/account/settings/transactions"/><SaveFeedbackForm action={save} className="account-form"><SavePendingFields><label>Default Due Days<input name="defaultDueDays" type="number" min="0" max="365" defaultValue={typeof values.defaultDueDays==="number"?values.defaultDueDays:0}/></label>{(["salesTerms","purchaseTerms","projectTerms"] as const).map(key=><label key={key}>{key==="salesTerms"?"Sale Terms & Conditions":key==="purchaseTerms"?"Purchase Terms & Conditions":"Project Terms & Conditions"}<textarea name={key} maxLength={5000} defaultValue={typeof values[key]==="string"?values[key]:""}/></label>)}</SavePendingFields><SaveSubmitButton>Save</SaveSubmitButton></SaveFeedbackForm></>;
}
