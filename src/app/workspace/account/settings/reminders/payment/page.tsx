import {revalidatePath} from "next/cache";
import {PaymentReminderSettings} from "@/components/account/payment-reminder-settings";
import {AuthorizationError,requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {db} from "@/lib/db";

type PaymentReminder={enabled?:boolean;overdueDays?:number;frequency?:string;message?:string};
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS");
 const current=await db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{transactionDefaults:true}});
 const defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const reminders=(defaults.reminderSettings as Record<string,unknown>|undefined)??{};
 const values=((reminders.payment as PaymentReminder|undefined)??{});
 async function save(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  const existing=await db.accountSettings.findUnique({where:{companyId:editor.companyId!},select:{transactionDefaults:true}});
  const transactionDefaults=(existing?.transactionDefaults as Record<string,unknown>|null)??{};
  const reminderSettings=(transactionDefaults.reminderSettings as Record<string,unknown>|undefined)??{};
  const previous=(reminderSettings.payment as Record<string,unknown>|undefined)??{};
  const payment={...previous,enabled:fd.get("enabled")==="on",overdueDays:Math.max(0,Math.min(365,Number(fd.get("overdueDays")||1))),frequency:String(fd.get("frequency")||"TWICE_DAILY")};
  await db.accountSettings.upsert({where:{companyId:editor.companyId!},create:{companyId:editor.companyId!,transactionDefaults:{...transactionDefaults,reminderSettings:{...reminderSettings,payment}}},update:{transactionDefaults:{...transactionDefaults,reminderSettings:{...reminderSettings,payment}}}});
  revalidatePath("/workspace/account/settings/reminders/payment");
 }
 return <PaymentReminderSettings values={values} action={save}/>;
}
