import {AccountDate} from "@/components/account/display-preferences";
import {Prisma} from "@prisma/client";
import Link from "next/link";
import {revalidatePath} from "next/cache";
import {AccountPageHeader} from "@/components/account/account-shell";
import {SaveFeedbackForm,SaveSubmitButton} from "@/components/account/save-feedback";
import {requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {saveBackupSettings} from "@/lib/account/backup-settings";
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS");if(actor.accountRole!=="ACCOUNT_ADMIN")throw new Error("UNAUTHORIZED");
 const row=await db.accountSettings.findUnique({where:{companyId:actor.companyId!}}),root=(row?.transactionDefaults??{}) as Record<string,unknown>,settings=(root.backupSettings??{}) as Record<string,unknown>;
 const backups=await db.accountBackupRecord.findMany({where:{companyId:actor.companyId!,manifest:{path:["objectKey"],not:Prisma.AnyNull}},orderBy:{generatedAt:"desc"},take:10});
 async function save(fd:FormData){"use server";await saveBackupSettings(await requirePermissionForMutation("ACCOUNT_SETTINGS"),{autoBackup:fd.get("autoBackup")==="on",intervalDays:Number(fd.get("intervalDays")),manualReminderDays:Number(fd.get("manualReminderDays"))});revalidatePath("/workspace/account/settings/backup")}
 return <><AccountPageHeader title="Backup Settings" backHref="/workspace/account/settings/general"/><SaveFeedbackForm action={save} className="backup-settings-list"><label className="general-settings-row"><span>Enable auto backup</span><input name="autoBackup" type="checkbox" defaultChecked={settings.autoBackup===true}/></label><label className="general-settings-row">Automatic Backup Interval (days)<input name="intervalDays" type="number" min="1" max="365" defaultValue={typeof settings.intervalDays==="number"?settings.intervalDays:7}/></label><label className="general-settings-row">Manual Backup Reminder (days)<input name="manualReminderDays" type="number" min="1" max="365" defaultValue={typeof settings.manualReminderDays==="number"?settings.manualReminderDays:7}/></label><p>Automatic accounting bundles are stored privately by the maintenance runner. Manual backup reminders appear in Attention. Keep database backups for full transaction recovery.</p><SaveSubmitButton>Save</SaveSubmitButton><Link className="account-primary" href="/workspace/account/utilities/backup">Open Manual Backup</Link></SaveFeedbackForm>{backups.map(x=><p key={x.id}><a download href={`/api/account/utilities/backup/${x.id}`}>Download backup — {<AccountDate value={x.generatedAt.toISOString()}/>}</a></p>)}</>;
}
