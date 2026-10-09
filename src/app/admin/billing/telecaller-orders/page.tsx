import Link from "next/link";
import { confirmTelecallerPaymentAction } from "@/app/actions/telecaller-billing";
import { telecallerOrdersPage } from "@/lib/billing/telecaller";

const money = (value: { toString(): string }) =>
  `₹${Number(value.toString()).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) =>
  d
    ? d.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "—";

export default async function TelecallerOrdersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; kind?: string }>;
}) {
  const query = await searchParams;
  const results = await telecallerOrdersPage({
    page: query.page,
    q: query.q,
    pending: query.kind !== "history",
  });
  const orders = results.items;
  const href = (page: number) =>
    `?${new URLSearchParams({ ...query, page: String(page) } as Record<string, string>)}`;
  return (
    <main className="admin-shell">
      <section className="admin-content">
        <div className="billing-title-row">
          <div>
            <p className="eyebrow">Super Admin</p>
            <h1>Telecaller Orders</h1>
            <p>
              Manual Telecaller payments activate only Telecaller seats and
              never alter normal Sales/Account subscriptions.
            </p>
          </div>
          <Link href="/admin/billing/orders">Normal Billing Orders</Link>
        </div>
        <form method="get" className="billing-form">
          <label>
            Payment status
            <select name="kind" defaultValue={query.kind ?? "pending"}>
              <option value="pending">Pending</option>
              <option value="history">History</option>
            </select>
          </label>
          <label>
            Search company, order or reference
            <input name="q" defaultValue={query.q} maxLength={160} />
          </label>
          <button>Apply filters</button>
        </form>
        <div className="employee-list">
          {orders.map((order) => (
            <article className="billing-card" key={order.id}>
              <h2>{order.companyName ?? order.companyId}</h2>
              <p>
                <strong>{order.status}</strong> ·{" "}
                {order.billingPeriod === "SIX_MONTH" ? "6 months" : "1 year"} ·
                +{order.addedSeats} seats → {order.targetSeats} total
              </p>
              <p>
                {money(order.totalAmount)} · unit {money(order.unitPrice)} ·
                created {fmt(order.createdAt)}
              </p>
              <p>
                Co-term: {fmt(order.coTermStartsAt)} → {fmt(order.coTermEndsAt)}
              </p>
              {order.paymentReference ? (
                <p>
                  Reference: {order.paymentReference} · paid {fmt(order.paidAt)}
                </p>
              ) : null}
              {order.status === "PENDING" ? (
                <form
                  action={confirmTelecallerPaymentAction}
                  className="employee-form"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <label>
                    Verified payment reference
                    <input
                      name="reference"
                      required
                      maxLength={200}
                      placeholder="UPI / bank / transaction reference"
                    />
                  </label>
                  <button>Confirm Payment & Activate Seats</button>
                </form>
              ) : null}
            </article>
          ))}
          {!orders.length ? <p>No Telecaller orders.</p> : null}
        </div>
        <nav aria-label="Telecaller payment pages">
          {results.page > 1 && (
            <Link href={href(results.page - 1)}>Previous page</Link>
          )}
          <span>Page {results.page}</span>
          {results.hasMore && (
            <Link href={href(results.page + 1)}>Next page</Link>
          )}
        </nav>
      </section>
    </main>
  );
}
