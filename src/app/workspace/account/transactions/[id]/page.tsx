import Link from "next/link";
import { randomUUID } from "node:crypto";
import {
  applyAdvanceAction,
  finalizeCommercialAction,
  postCommercialAction,
  reminderStatusAction,
  saveReminderAction,
} from "@/app/actions/commercial";
import {
  commercialDocumentControls,
  getCommercialDocument,
} from "@/lib/account/commercial";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    [x, controls] = await Promise.all([
      getCommercialDocument(id),
      commercialDocumentControls(id),
    ]),
    today = new Date().toISOString().slice(0, 10);
  return (
    <main>
      <h1>
        {x.type} {x.documentNumber}
      </h1>
      <p>
        {x.partyName} · {x.branch.name} · {x.status}
      </p>
      <p>
        Issue {x.issueDate.toLocaleDateString()}{" "}
        {x.dueDate && `· Due ${x.dueDate.toLocaleDateString()}`}
      </p>
      {x.purchasePurpose && (
        <p>
          Purpose {x.purchasePurpose}
          {x.projectReference && ` · Project reference ${x.projectReference}`}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Discount</th>
            <th>Tax</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {x.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.itemName}</td>
              <td>{line.description}</td>
              <td>{line.quantity.toString()}</td>
              <td>{line.rate.toString()}</td>
              <td>{line.discountAmount.toString()}</td>
              <td>{line.taxAmount.toString()}</td>
              <td>{line.lineTotal.toString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Subtotal {x.subtotal.toString()} · Discounts{" "}
        {x.discountTotal.toString()} · Taxable {x.taxableTotal.toString()} · Tax{" "}
        {x.taxTotal.toString()} · Total {x.grandTotal.toString()}
      </p>
      {x.financial && (
        <p>
          Outstanding {x.financial.outstanding.toString()} ·{" "}
          {x.financial.paymentStatus}
        </p>
      )}
      {x.status === "DRAFT" && x.type === "PURCHASE_ORDER" && (
        <form action={finalizeCommercialAction}>
          <input type="hidden" name="id" value={x.id} />
          <button>Finalize / Issue Purchase Order</button>
        </form>
      )}
      {x.status === "DRAFT" &&
        [
          "SALES_INVOICE",
          "CREDIT_NOTE",
          "PURCHASE_BILL",
          "DEBIT_NOTE",
        ].includes(x.type) && (
          <form action={postCommercialAction}>
            <input type="hidden" name="id" value={x.id} />
            <button>Post / Issue</button>
          </form>
        )}
      <p><Link href={`/api/account/print/${x.type}/${x.id}`}>Print / Preview</Link> · <Link href={`/api/account/print/${x.type}/${x.id}?format=pdf`}>Download PDF</Link></p><h2>Adjustments and payments</h2>
      {x.adjustments.map((a) => (
        <p key={a.id}>
          {a.type} {a.documentNumber}: {a.grandTotal.toString()}
        </p>
      ))}
      {x.allocations.map((a) => (
        <p key={a.id}>Allocated payment: {a.amount.toString()}</p>
      ))}
      {x.advanceApplications.map((a) => (
        <p key={a.id}>
          Applied advance: {a.amount.toString()} on{" "}
          {a.applicationDate.toLocaleDateString()}
        </p>
      ))}
      {controls.canManage &&
        x.financial &&
        !x.financial.outstanding.isZero() &&
        controls.advances.length > 0 && (
          <section>
            <h2>Apply advance</h2>
            {controls.advances.map((a) => (
              <form action={applyAdvanceAction} key={a.id}>
                <input type="hidden" name="advanceId" value={a.id} />
                <input type="hidden" name="documentId" value={x.id} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={randomUUID()}
                />
                <span>
                  {a.settlementNumber} · Available{" "}
                  {a.remainingAmount.toString()}{" "}
                </span>
                <label>
                  Amount{" "}
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={a.remainingAmount.toString()}
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Application date{" "}
                  <input
                    name="applicationDate"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </label>
                <button>Apply Advance</button>
              </form>
            ))}
          </section>
        )}
      <h2>Reminders</h2>
      {controls.canRemind && (
        <form action={saveReminderAction}>
          <input type="hidden" name="documentId" value={x.id} />
          <label>
            Reminder date/time{" "}
            <input name="remindAt" type="datetime-local" required />
          </label>
          <label>
            Message{" "}
            <textarea
              name="message"
              defaultValue={`Payment reminder for ${x.documentNumber}`}
              required
            />
          </label>
          <button>Create Reminder</button>
        </form>
      )}
      {x.reminders.map((r) => (
        <div key={r.id}>
          <p>
            {r.status} · {r.remindAt.toLocaleString()} · {r.message}
            {r.sentAt && ` · Sent ${r.sentAt.toLocaleString()}`}
          </p>
          {controls.canRemind && r.status === "PENDING" && (
            <form action={reminderStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <button name="status" value="SENT">
                Mark Sent
              </button>
              <button name="status" value="DISMISSED">
                Dismiss
              </button>
            </form>
          )}
        </div>
      ))}
    </main>
  );
}
