import Link from "next/link";
import { platformOrdersPage } from "@/lib/billing/service";
import { confirmManualPaymentAction } from "@/app/actions/billing";
import { confirmTelecallerPaymentAction } from "@/app/actions/telecaller-billing";
import { telecallerOrdersPage } from "@/lib/billing/telecaller";
import { ACCOUNT_PACKAGE_ORDER_PROVIDER } from "@/lib/billing/account-package";
import { PLUS_ORDER_PROVIDER } from "@/lib/billing/combined-order";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
const fmt = (d: Date) =>
  d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    pendingPage?: string;
    historyPage?: string;
  }>;
}) {
  const query = await searchParams;
  const [normalPending, normalHistory, legacyPending, legacyHistory] =
    await Promise.all([
      platformOrdersPage({
        q: query.q,
        page: query.pendingPage,
        pending: true,
      }),
      platformOrdersPage({ q: query.q, page: query.historyPage }),
      telecallerOrdersPage({
        q: query.q,
        page: query.pendingPage,
        pending: true,
      }),
      telecallerOrdersPage({ q: query.q, page: query.historyPage }),
    ]);
  const pending = normalPending.items,
    history = normalHistory.items,
    telePending = legacyPending.items,
    teleHistory = legacyHistory.items;
  const pages = (
    kind: "pending" | "history",
    page: number,
    hasMore: boolean,
  ) => {
    const href = (n: number) =>
      `?${new URLSearchParams({ ...query, [kind + "Page"]: String(n) } as Record<string, string>)}`;
    return (
      <nav aria-label={kind + " payment pages"}>
        {page > 1 && <Link href={href(page - 1)}>Previous {kind} page</Link>}
        <span>Page {page}</span>
        {hasMore && <Link href={href(page + 1)}>Next {kind} page</Link>}
      </nav>
    );
  };
  return (
    <main className="billing-content admin-content">
      <p className="eyebrow">Platform administration</p>
      <h1>Billing</h1>
      <p className="muted">
        All Sales, Account and legacy Telecaller payment verification is shown
        here. New Telecaller seats are part of normal Sales Add Team / Renewal
        orders.
      </p>
      <form method="get" className="billing-form">
        <label>
          Search company, order or payment reference
          <input name="q" defaultValue={query.q} maxLength={160} />
        </label>
        <button>Search payments</button>
      </form>
      <section className="billing-card">
        <h2>Pending Payments</h2>
        {pending.length === 0 && telePending.length === 0 && (
          <p className="muted">No pending payments.</p>
        )}
        {pending.map((o) => (
          <article className="company-billing" key={o.id}>
            <div>
              <strong>{o.company.name}</strong>
              <span>
                {o.provider === ACCOUNT_PACKAGE_ORDER_PROVIDER
                  ? `${o.accountPackages || o.adminSeats} Account package${(o.accountPackages || o.adminSeats) === 1 ? "" : "s"} · ${o.billingPeriod}`
                  : o.provider === PLUS_ORDER_PROVIDER
                    ? `${o.billingPeriod} · ${o.adminSeats} Admin / ${o.managerSeats} Manager / ${o.salesSeats} Sales / ${o.accountPackages} Account package${o.accountPackages === 1 ? "" : "s"}`
                    : `${o.billingPeriod} · ${o.adminSeats} Admin / ${o.managerSeats} Manager / ${o.salesSeats} Sales team`}
              </span>
              <span>
                {money(Number(o.totalAmount))} · Ref{" "}
                {o.id.slice(0, 8).toUpperCase()} · {fmt(o.createdAt)}
              </span>
            </div>
            <form action={confirmManualPaymentAction} className="billing-form">
              <input type="hidden" name="orderId" value={o.id} />
              <label>
                Payment reference
                <input
                  name="reference"
                  minLength={3}
                  maxLength={100}
                  placeholder="Bank / UPI reference"
                  required
                />
              </label>
              <button>Approve & Activate Subscription</button>
            </form>
          </article>
        ))}
        {telePending.map((o) => (
          <article className="company-billing" key={`tele-${o.id}`}>
            <div>
              <strong>{o.companyName ?? o.companyId}</strong>
              <span>
                Legacy Telecaller Add Team · +{o.addedSeats} seats →{" "}
                {o.targetSeats} total · {o.billingPeriod}
              </span>
              <span>
                {money(Number(o.totalAmount))} · Ref{" "}
                {o.id.slice(0, 8).toUpperCase()} · {fmt(o.createdAt)}
              </span>
            </div>
            <form
              action={confirmTelecallerPaymentAction}
              className="billing-form"
            >
              <input type="hidden" name="orderId" value={o.id} />
              <label>
                Payment reference
                <input
                  name="reference"
                  minLength={3}
                  maxLength={200}
                  placeholder="Bank / UPI reference"
                  required
                />
              </label>
              <button>Approve & Co-term Telecaller Seats</button>
            </form>
          </article>
        ))}
        {pages(
          "pending",
          normalPending.page,
          normalPending.hasMore || legacyPending.hasMore,
        )}
      </section>
      <section className="billing-card">
        <h2>Payment History</h2>
        {history.length === 0 && teleHistory.length === 0 && (
          <p className="muted">No completed or closed orders.</p>
        )}
        {history.map((o) => (
          <article className="history-row" key={o.id}>
            <div>
              <strong>{o.company.name}</strong>
              <span>
                {o.billingPeriod} · Ref {o.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <b>
              {money(Number(o.totalAmount))} · {o.status}
            </b>
          </article>
        ))}
        {teleHistory.map((o) => (
          <article className="history-row" key={`tele-${o.id}`}>
            <div>
              <strong>{o.companyName ?? o.companyId} · Telecaller</strong>
              <span>
                {o.billingPeriod} · +{o.addedSeats} seats · Ref{" "}
                {o.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <b>
              {money(Number(o.totalAmount))} · {o.status}
            </b>
          </article>
        ))}
        {pages(
          "history",
          normalHistory.page,
          normalHistory.hasMore || legacyHistory.hasMore,
        )}
      </section>
      <Link href="/admin">← Dashboard</Link>
    </main>
  );
}
