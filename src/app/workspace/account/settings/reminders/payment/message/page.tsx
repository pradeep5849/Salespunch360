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
  const existing=await db.accountSettings.findUnique({where:{companyId:editor.companyId!},select:{transactionDefaults:true}});
  const transactionDefaults=(existing?.transactionDefaults as Record<string,unknown>|null)??{};
  const reminderSettings=(transactionDefaults.reminderSettings as Record<string,unknown>|undefined)??{};
  const previous=(reminderSettings.payment as Record<string,unknown>|undefined)??{};
  const nextMessage=String(fd.get("message")??"").slice(0,2000);
  await db.accountSettings.upsert({where:{companyId:editor.companyId!},create:{companyId:editor.companyId!,transactionDefaults:{...transactionDefaults,reminderSettings:{...reminderSettings,payment:{...previous,message:nextMessage}}}},update:{transactionDefaults:{...transactionDefaults,reminderSettings:{...reminderSettings,payment:{...previous,message:nextMessage}}}}});
  revalidatePath("/workspace/account/settings/reminders/payment/message");
 }
 return <main className={styles.sheet}>
  <header className={styles.header}><Link href="/workspace/account/settings/reminders/payment" aria-label="Back">←</Link><h1>Reminder message to party</h1></header>
  <form action={save} className={styles.message}><textarea name="message" defaultValue={message} maxLength={2000}/><button type="submit">Save Reminder Message</button></form>
 </main>;
}
