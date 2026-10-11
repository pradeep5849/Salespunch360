import {SaveFeedbackForm,SaveSubmitButton,SavePendingFields} from "@/components/account/save-feedback";
import {saveReminderSettingsForActor} from "@/lib/account/reminder-settings";
import type {ProjectActor} from "@/lib/account/projects";
import Link from "next/link";
import {revalidatePath} from "next/cache";
import {AuthorizationError,requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import styles from "@/components/account/reminder-settings.module.css";

export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS");
 const current=await db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{transactionDefaults:true}});
 const defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const reminders=(defaults.reminderSettings as Record<string,unknown>|undefined)??{};
 const payment=(reminders.payment as Record<string,unknown>|undefined)??{};
 const message=typeof payment.message==="string"?payment.message:"Dear {party}, payment of {amount} is overdue. Please arrange payment at the earliest.";
 async function save(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  await saveReminderSettingsForActor(editor as ProjectActor,{payment:{message:String(fd.get("message")??"")}});
  revalidatePath("/workspace/account/settings/reminders/payment/message");
 }
 return <main className={styles.sheet}>
  <header className={styles.header}><Link href="/workspace/account/settings/reminders/payment" aria-label="Back">←</Link><h1>Reminder message to party</h1></header>
  <SaveFeedbackForm action={save} className={styles.message}><SavePendingFields><textarea aria-label="Reminder message" name="message" required defaultValue={message} maxLength={2000}/></SavePendingFields><SaveSubmitButton>Save Reminder Message</SaveSubmitButton></SaveFeedbackForm>
 </main>;
}
