import {revalidatePath} from "next/cache";
import {AccountPageHeader} from "@/components/account/account-shell";
import {SaveFeedbackForm,SaveSubmitButton,SavePendingFields} from "@/components/account/save-feedback";
import {getAccountSettings} from "@/lib/account/settings";
import {resolveTransactionMessaging,saveTransactionMessaging} from "@/lib/account/transaction-messaging";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
export default async function Page(){
 const settings=await getAccountSettings(),values=resolveTransactionMessaging(settings?.transactionDefaults);
 async function save(fd:FormData){"use server";await saveTransactionMessaging(await requirePermissionForMutation("ACCOUNT_SETTINGS"),{sendToParty:fd.get("sendToParty")==="on",copyToSelf:fd.get("copyToSelf")==="on",includeInvoiceLink:fd.get("includeInvoiceLink")==="on"});revalidatePath("/workspace/account/settings/transaction-sms")}
 return <main className="account-inner-page settings-inner-page"><AccountPageHeader title="Transaction SMS" backHref="/workspace/account/settings"/><p>Prepare messages for manual sending from a sale. Choose SMS, WhatsApp, copy, or share.</p><SaveFeedbackForm action={save}><SavePendingFields><section className="transaction-sms-list">{([["sendToParty","Send to party"],["copyToSelf","Prepare Copy to Self"],["includeInvoiceLink","Include Invoice Link"]] as const).map(([key,label])=><label className="general-settings-row" key={key}><span>{label}</span><input name={key} className="settings-switch" type="checkbox" defaultChecked={values[key]}/></label>)}</section></SavePendingFields><SaveSubmitButton>Save</SaveSubmitButton></SaveFeedbackForm></main>;
}
