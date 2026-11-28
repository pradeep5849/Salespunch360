import { cookies } from "next/headers";
import { BILLING_CONFIRMATION_COOKIE } from "@/lib/analytics/policy";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { confirmedBillingSuccess } from "@/lib/analytics/server";
import { PurchaseConversion } from "@/components/analytics/purchase-conversion";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Payment successful",
  robots: { index: false, follow: false },
};
type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function Page({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const raw =
    (Array.isArray(q.order) ? q.order[0] : q.order) ??
    (await cookies()).get(BILLING_CONFIRMATION_COOKIE)?.value;
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) redirect("/workspace/billing");
  const confirmed = await confirmedBillingSuccess(parsed.data);
  if (!confirmed)
    redirect(
      `/workspace/billing/pending?order=${encodeURIComponent(parsed.data)}`,
    );
  const { order, payment } = confirmed;
  const sandbox = payment.provider === "CASHFREE_SANDBOX";
  const button = {
    display: "block",
    padding: "14px 16px",
    borderRadius: 10,
    textAlign: "center" as const,
    fontWeight: 700,
    textDecoration: "none",
  };
  return (
    <main className="billing-content">
      <section className="billing-card">
        <h1>Payment successful</h1>
        <p>Subscription payment verified and activated.</p>
        <h2>
          {new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: order.currency,
            maximumFractionDigits: 2,
          }).format(Number(payment.amount))}
        </h2>
        <div className="billing-summary">
          <article>
            <strong>{order.id}</strong>
            <span>Order ID</span>
          </article>
          <article>
            <strong>
              {payment.providerPaymentId.replace(/^cashfree_sandbox_/, "")}
            </strong>
            <span>Cashfree payment ID</span>
          </article>
          <article>
            <strong>
              {payment.capturedAt?.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </strong>
            <span>Payment date</span>
          </article>
          <article>
            <strong>Paid</strong>
            <span>Payment status</span>
          </article>
        </div>
        {sandbox && <p>Sandbox test payment — no real money charged.</p>}
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <Link
            href="/workspace/billing"
            style={{ ...button, background: "#2563eb", color: "#fff" }}
          >
            Back to Billing &amp; Subscription
          </Link>
          <a
            href={`/api/billing/cashfree/receipt?order=${encodeURIComponent(order.id)}`}
            download
            style={{ ...button, border: "1px solid #2563eb", color: "#2563eb" }}
          >
            Download Receipt
          </a>
        </div>
        {!sandbox && <PurchaseConversion orderId={order.id} />}
      </section>
    </main>
  );
}
