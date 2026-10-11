import {backupReminderDue} from "@/lib/account/backup-settings";
import {duePaymentReminders} from "@/lib/account/payment-reminder-execution";
import Link from "next/link";
import {AccountCard,AccountEmptyState,AccountPageHeader} from "@/components/account/account-shell";
import {ManualMessage} from "@/components/account/manual-message";
import {AccountDate} from "@/components/account/display-preferences";
import {requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {dueServiceReminders,completeServiceReminder} from "@/lib/account/service-reminders";
import {revalidatePath} from "next/cache";
import {ActionFeedbackForm} from "@/components/account/action-feedback-form";
import {accountAction} from "@/lib/account/action-feedback";
import {db} from "@/lib/db";
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_DASHBOARD"),branch=actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{};
 async function complete(form:FormData){"use server";const editor=await requirePermissionForMutation("ACCOUNT_DASHBOARD");return accountAction(async()=>{await completeServiceReminder(editor,String(form.get("lineId")));revalidatePath("/workspace/account/notifications")},"Service marked completed")}
 const [pending,reminders,payments,backupDue]=await Promise.all([db.expenseTransaction.count({where:{companyId:actor.companyId!,status:"PENDING_APPROVAL",...branch}}),dueServiceReminders(actor),duePaymentReminders(actor),actor.accountRole==="ACCOUNT_ADMIN"?backupReminderDue(actor.companyId!):false]);
 return <><AccountPageHeader title="Attention" subtitle="Items needing action in your authorized branches."/><AccountCard>{pending>0&&<Link href="/workspace/account/expenses?status=PENDING_APPROVAL">{pending} expenses await approval →</Link>}{!pending&&!reminders.length&&!payments.length&&!backupDue&&<AccountEmptyState title="All caught up" detail="There are no current Account alerts in your authorized Branch scope."/>}{backupDue&&<p><Link href="/workspace/account/utilities/backup">Your manual backup is due →</Link></p>}{payments.map(x=><section key={x.id}><h3>Payment reminder — {x.partyName}</h3><Link href={`/workspace/account/sales/${x.documentId}`}>{x.documentNumber} →</Link><ManualMessage message={x.message} phone={x.phone}/></section>)}{reminders.map(x=><section key={x.id}><h3>{x.itemName} — {x.partyName}</h3><p>Service due: <AccountDate value={x.dueDate}/></p><Link href={`/workspace/account/sales/${x.documentId}`}>{x.documentNumber} →</Link><ManualMessage message={x.message} phone={x.phone}/><ActionFeedbackForm action={complete}><input type="hidden" name="lineId" value={x.lineId}/><button>Mark service completed</button></ActionFeedbackForm></section>)}</AccountCard></>;
}
