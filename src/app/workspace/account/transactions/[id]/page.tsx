import {OrderProgress} from "@/components/account/order-progress";
import {Money,AccountTimestamp} from "@/components/account/account-ui";
import {AccountDate} from "@/components/account/display-preferences";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import {
  applyAdvanceAction,
  confirmSalesOrderAction,
  finalizeCommercialAction,
  postCommercialAction,
  reminderStatusAction,
  saveReminderAction,
} from "@/app/actions/commercial";
import {
  commercialDocumentControls,
  getCommercialDocument,
} from "@/lib/account/commercial";
import { redirect } from "next/navigation";
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
  // Every invoice entry point uses the scoped financial snapshot and retained metadata.
  if (x.type === "SALES_INVOICE") redirect(`/workspace/account/sales/${x.id}`);

  return (
    <main>
      <h1>
        {x.type} {x.documentNumber}
      </h1>
      <p>
        {x.partyName} · {x.branch.name} · {x.status}
      </p>
      <p>
        Issue {<AccountDate value={x.issueDate.toISOString()}/>}{" "}
        {x.dueDate && <>· Due <AccountDate value={x.dueDate.toISOString()}/></>}
      </p>
      {["SALES_ORDER","PURCHASE_ORDER"].includes(x.type)&&<OrderProgress id={x.id}/>}
      {x.purchasePurpose && (
        <section className="account-card">
          <h2>Purchase information</h2>
          <p>
            Purchase For {x.purchasePurpose}
            {x.projectReference && ` · Project reference ${x.projectReference}`}
            {x.materialTreatment &&
              ` · ${x.materialTreatment.replaceAll("_", " ")}`}
          </p>
          <p>
            Vendor invoice {x.vendorInvoiceNumber ?? "—"}{" "}
            {x.vendorInvoiceDate &&
              <>· <AccountDate value={x.vendorInvoiceDate.toISOString()}/></>}{" "}
            · Accounting date{" "}
            {<AccountDate value={(x.postingDate ?? x.issueDate).toISOString()}/>}
          </p>
          <p>
            Vendor GSTIN {x.partyGstin ?? "—"} · Address {x.partyAddress ?? "—"}{" "}
            · GRN {x.grnReference ?? "—"}
          </p>
          <p>
            Payment terms {x.paymentTerms ?? "—"} · Location{" "}
            {x.purchaseLocation ?? "—"}
          </p>
          <p>
            Freight {<Money value={x.freightAmount}/>} · Other charges{" "}
            {<Money value={x.otherChargesAmount}/>} · Round-off{" "}
            {<Money value={x.roundOffAmount}/>}
          </p>
        </section>
      )}
      {x.project && (
        <p>
          Project {x.project.projectNumber} · {x.project.name}
        </p>
      )}
      {x.sourcePurchaseOrder && (
        <p><Link href={`/workspace/account/transactions/${x.sourcePurchaseOrder.id}`}>Purchase Order {x.sourcePurchaseOrder.documentNumber}</Link></p>
      )}
      <div className="table-wrap" role="region" aria-label="Commercial line items" tabIndex={0}><table>
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
              <td>{<Money value={line.rate}/>}</td>
              <td>{<Money value={line.discountAmount}/>}</td>
              <td>{<Money value={line.taxAmount}/>}</td>
              <td>{<Money value={line.lineTotal}/>}</td>
            </tr>
          ))}
          {x.lines
            .flatMap((line) =>
              line.purchaseAllocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td colSpan={7}>
                    Allocation: {allocation.allocationType.replaceAll("_", " ")}{" "}
                    · Qty {allocation.quantity.toString()} · Taxable{" "}
                    {<Money value={allocation.taxableAmount}/>} · Tax{" "}
                    {<Money value={allocation.taxAmount}/>}
                  </td>
                </tr>
              )),
            )
            .map((row) => row)}
        </tbody>
      </table></div>
      <p>
        Subtotal {<Money value={x.subtotal}/>} · Discounts{" "}
        {<Money value={x.discountTotal}/>} · Taxable {<Money value={x.taxableTotal}/>} · Tax{" "}
        {<Money value={x.taxTotal}/>} · Total {<Money value={x.grandTotal}/>}
      </p>
      {x.financial && (
        <p>
          Outstanding {<Money value={x.financial.outstanding}/>} ·{" "}
          {x.financial.paymentStatus}
        </p>
      )}
      {controls.canConfirmSalesOrder&&<form action={confirmSalesOrderAction}><input type="hidden" name="id" value={x.id}/><button>Confirm Sale Order</button><p>Confirmation closes the linked estimate. No accounting entry is posted for an order.</p></form>}
      {controls.canConfirmPurchaseOrder && x.status === "DRAFT" && x.type === "PURCHASE_ORDER" && (
        <form action={finalizeCommercialAction}>
          <input type="hidden" name="id" value={x.id} />
          <button>Finalize / Issue Purchase Order</button>
        </form>
      )}
      {controls.canPost && x.status === "DRAFT" &&
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
      {(x.stockMovements.length > 0 ||
        x.projectMaterialMovements.length > 0) && (
        <section>
          <h2>Inventory and Project material history</h2>
          {x.stockMovements.map((m) => (
            <p key={m.id}>
              Stock {m.movementType.replaceAll("_", " ")} · Qty{" "}
              {m.quantity.toString()} · Value {<Money value={m.totalCost}/>}
            </p>
          ))}
          {x.projectMaterialMovements.map((m) => (
            <p key={m.id}>
              Project material {m.movementType.replaceAll("_", " ")} · Qty{" "}
              {m.quantity.toString()} · Value {<Money value={m.totalCost}/>}
            </p>
          ))}
        </section>
      )}
      <p>
        <Link href={`/api/account/print/${x.type}/${x.id}`}>
          Print / Preview
        </Link>{" "}
        ·{" "}
        <Link href={`/api/account/print/${x.type}/${x.id}?format=pdf`}>
          Download PDF
        </Link>
      </p>
      <h2>Adjustments and payments</h2>
      {x.adjustments.map((a) => (
        <p key={a.id}>
          {a.type} {a.documentNumber}: {<Money value={a.grandTotal}/>}
        </p>
      ))}
      {x.allocations.map((a) => (
        <p key={a.id}>Allocated payment: {<Money value={a.amount}/>}</p>
      ))}
      {x.advanceApplications.map((a) => (
        <p key={a.id}>
          Applied advance: {<Money value={a.amount}/>} on{" "}
          {<AccountDate value={a.applicationDate.toISOString()}/>}
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
                  {<Money value={a.remainingAmount}/>}{" "}
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
            {r.status} · <AccountTimestamp value={r.remindAt}/> · {r.message}
            {r.sentAt && <> · Sent <AccountTimestamp value={r.sentAt}/></>}
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
