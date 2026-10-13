import { backupReminderDue } from "@/lib/account/backup-settings";
import { duePaymentReminders } from "@/lib/account/payment-reminder-execution";
import { pendingExpenseAlertsForActor } from "@/lib/account/expense-alerts";
import type { ProjectActor } from "@/lib/account/projects";
import Link from "next/link";
import {
  AccountCard,
  AccountEmptyState,
  AccountPageHeader,
} from "@/components/account/account-shell";
import { ManualMessage } from "@/components/account/manual-message";
import {
  AccountDate,
  ClientMoney,
} from "@/components/account/display-preferences";
import {
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import {
  dueServiceReminders,
  completeServiceReminder,
} from "@/lib/account/service-reminders";
import { revalidatePath } from "next/cache";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { accountAction } from "@/lib/account/action-feedback";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await requirePermission("ACCOUNT_DASHBOARD"),
    query = await searchParams;
  const alerts = await pendingExpenseAlertsForActor(
    { ...actor, companyId: actor.companyId! } as ProjectActor,
    query,
  );
  const scoped = alerts.scopedActor;
  async function complete(form: FormData) {
    "use server";
    const editor = await requirePermissionForMutation("ACCOUNT_DASHBOARD");
    return accountAction(async () => {
      const authorized = await pendingExpenseAlertsForActor(
        { ...editor, companyId: editor.companyId! } as ProjectActor,
        query,
        true,
      );
      await completeServiceReminder(
        authorized.scopedActor,
        String(form.get("lineId")),
      );
      revalidatePath("/workspace/account/notifications");
    }, "Service marked completed");
  }
  const [reminders, payments, backupDue] = await Promise.all([
    dueServiceReminders(scoped),
    duePaymentReminders(scoped),
    actor.accountRole === "ACCOUNT_ADMIN"
      ? backupReminderDue(actor.companyId!)
      : false,
  ]);
  const scope: Record<string, string> =
    alerts.branchContext.mode === "COMPANY"
      ? { scope: "all" }
      : { branchId: alerts.branchContext.branchId };
  const href = (offset: number) =>
    `?${new URLSearchParams({ ...scope, offset: String(offset), limit: String(alerts.limit) })}`;
  return (
    <>
      <AccountPageHeader
        title="Attention"
        subtitle={
          alerts.branchContext.mode === "COMPANY"
            ? "All company branches"
            : alerts.branchContext.branchName
        }
      />
      <AccountCard>
        {alerts.total > 0 && (
          <section>
            <h2>{alerts.total} expenses await review</h2>
            <ul>
              {alerts.rows.map((x) => (
                <li key={x.id}>
                  <Link href={`/workspace/account/expenses/${x.id}`}>
                    {x.transactionNumber}
                  </Link>{" "}
                  · <ClientMoney value={x.totalAmount.toFixed(2)} />
                  {x.approvalReviewStatus === "PENDING" && x.status === "POSTED"
                    ? " · Paid; review pending"
                    : ""}
                </li>
              ))}
            </ul>
            <nav aria-label="Expense alert pages">
              {alerts.offset > 0 && (
                <Link href={href(Math.max(0, alerts.offset - alerts.limit))}>
                  Previous
                </Link>
              )}{" "}
              {alerts.hasMore && (
                <Link href={href(alerts.offset + alerts.limit)}>Next</Link>
              )}
            </nav>
          </section>
        )}
        {!alerts.total &&
          !reminders.length &&
          !payments.length &&
          !backupDue && (
            <AccountEmptyState
              title="All caught up"
              detail="There are no current Account alerts in this Branch scope."
            />
          )}
        {backupDue && (
          <p>
            <Link href="/workspace/account/utilities/backup">
              Your manual backup is due →
            </Link>
          </p>
        )}
        {payments.map((x) => (
          <section key={x.id}>
            <h3>Payment reminder — {x.partyName}</h3>
            <Link href={`/workspace/account/sales/${x.documentId}`}>
              {x.documentNumber} →
            </Link>
            <ManualMessage message={x.message} phone={x.phone} />
          </section>
        ))}
        {reminders.map((x) => (
          <section key={x.id}>
            <h3>
              {x.itemName} — {x.partyName}
            </h3>
            <p>
              Service due: <AccountDate value={x.dueDate} />
            </p>
            <Link href={`/workspace/account/sales/${x.documentId}`}>
              {x.documentNumber} →
            </Link>
            <ManualMessage message={x.message} phone={x.phone} />
            <ActionFeedbackForm action={complete}>
              <input type="hidden" name="lineId" value={x.lineId} />
              <button>Mark service completed</button>
            </ActionFeedbackForm>
          </section>
        ))}
      </AccountCard>
    </>
  );
}
