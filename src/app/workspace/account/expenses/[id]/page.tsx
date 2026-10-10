import Link from "next/link";
import {
  expenseAttachmentAction,
  expenseLifecycleAction,
} from "@/app/actions/expenses";
import { getExpense } from "@/lib/account/expenses";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    x = await getExpense(id),
    c = x.capabilities;
  const who = (userId: string | null) =>
    x.people.find((p) => p.id === userId)?.name ?? "Historical user";
  const control = (operation: string, label: string) => (
    <ActionFeedbackForm key={operation} action={expenseLifecycleAction}>
      <input type="hidden" name="id" value={id} />
      <SaveSubmitButton name="operation" value={operation}>
        {label}
      </SaveSubmitButton>
    </ActionFeedbackForm>
  );
  const lines = Array.isArray(x.billedItems)
    ? (x.billedItems as { name: string; quantity: string; rate: string }[])
    : [];
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={x.transactionNumber}
          backHref="/workspace/account/expenses"
        />
        <dl>
          {Object.entries({
            Type: x.type,
            Status: x.status,
            Date: x.transactionDate.toISOString().slice(0, 10),
            Branch: x.branch?.name ?? "Historical branch",
            Category: x.category?.name ?? "Historical category",
            Project: x.project?.name ?? "No project",
            "Cash / bank":
              x.moneyAccount?.name ??
              (x.type === "REIMBURSEMENT"
                ? "Reimbursement payable"
                : "Not recorded"),
            "Taxable amount": x.taxableAmount.toFixed(2),
            "Tax mode": x.taxMode,
            "Tax rate": x.taxRate.toFixed(2),
            CGST: x.cgstAmount.toFixed(2),
            SGST: x.sgstAmount.toFixed(2),
            IGST: x.igstAmount.toFixed(2),
            CESS: x.cessAmount.toFixed(2),
            "Input tax credit": x.taxCreditTreatment,
            "State of supply": x.stateOfSupplyCode ?? "Not recorded",
            Charges: x.additionalCharges.toFixed(2),
            "Round off": x.roundOffAmount.toFixed(2),
            Total: x.totalAmount.toFixed(2),
            Reference: x.reference ?? "None",
            Notes: x.notes ?? "None",
            Creator: who(x.createdById),
            Approver: x.approvedById
              ? who(x.approvedById)
              : "Automatic / not approved",
            "Approved at": x.approvedAt?.toISOString() ?? "Not recorded",
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd style={{ overflowWrap: "anywhere" }}>{value}</dd>
            </div>
          ))}
        </dl>
        {lines.length > 0 && (
          <section>
            <h2>Billed items</h2>
            {lines.map((l, i) => (
              <p key={i}>
                {l.name} · {l.quantity} × ₹{l.rate}
              </p>
            ))}
          </section>
        )}
        <section aria-label="Expense actions">
          {c.edit && (
            <Link href={`/workspace/account/expenses/${id}/edit`}>
              Edit draft
            </Link>
          )}
          {c.submit && control("PENDING_APPROVAL", "Submit")}
          {c.cancel && control("CANCELLED", "Cancel expense")}
          {c.approve && control("APPROVED", "Approve")}
          {c.post && control("POSTED", "Post")}
          {c.reject && (
            <ActionFeedbackForm action={expenseLifecycleAction}>
              <input type="hidden" name="id" value={id} />
              <label>
                Rejection reason
                <input name="reason" required maxLength={500} />
              </label>
              <SaveSubmitButton name="operation" value="REJECTED">
                Reject
              </SaveSubmitButton>
            </ActionFeedbackForm>
          )}
          {c.reverse && (
            <ActionFeedbackForm action={expenseLifecycleAction}>
              <input type="hidden" name="id" value={id} />
              <label>
                Reversal date
                <input type="date" name="entryDate" required />
              </label>
              <label>
                Reversal reason
                <input name="reason" required maxLength={500} />
              </label>
              <SaveSubmitButton name="operation" value="REVERSED">
                Reverse
              </SaveSubmitButton>
            </ActionFeedbackForm>
          )}
        </section>
        <h2>Attachments</h2>
        {c.attach && (
          <ActionFeedbackForm action={expenseAttachmentAction}>
            <input type="hidden" name="id" value={id} />
            <label>
              Upload PDF or image (maximum 10 MB)
              <input
                type="file"
                name="file"
                accept="application/pdf,image/jpeg,image/png"
                required
              />
            </label>
            <SaveSubmitButton>Upload attachment</SaveSubmitButton>
          </ActionFeedbackForm>
        )}
        {x.attachments.map((a) => (
          <p key={a.id}>
            <a href={`/api/expense-attachments/${a.id}`}>
              Download {a.displayName}
            </a>{" "}
            · {a.sizeBytes} bytes · {a.createdAt.toISOString().slice(0, 10)}
          </p>
        ))}
        {!x.attachments.length && <p>No attachments.</p>}
        <h2>History</h2>
        {x.history.map((h) => {
          const m = h.metadata as { reason?: string } | null;
          return (
            <p key={h.id}>
              {h.eventType.replaceAll("_", " ")} · {who(h.actorUserId)} ·{" "}
              {h.createdAt.toISOString()}
              {m?.reason && ` · ${m.reason}`}
            </p>
          );
        })}
      </section>
    </div>
  );
}
