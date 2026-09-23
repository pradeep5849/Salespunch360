import Link from "next/link";
import { confirmTelecallerPaymentAction } from "@/app/actions/telecaller-billing";
import { listTelecallerBillingOrdersForAdmin } from "@/lib/billing/telecaller";

const money=(value:{toString():string})=>`₹${Number(value.toString()).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
const fmt=(d:Date|null)=>d?d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}):"—";

export default async function TelecallerOrdersAdminPage(){
  const orders=await listTelecallerBillingOrdersForAdmin();
  return <main className="admin-shell"><section className="admin-content"><div className="billing-title-row"><div><p className="eyebrow">Super Admin</p><h1>Telecaller Orders</h1><p>Manual Telecaller payments activate only Telecaller seats and never alter normal Sales/Account subscriptions.</p></div><Link href="/admin/billing/orders">Normal Billing Orders</Link></div>
    <div className="employee-list">{orders.map(order=><article className="billing-card" key={order.id}><h2>{order.companyName??order.companyId}</h2><p><strong>{order.status}</strong> · {order.billingPeriod==="SIX_MONTH"?"6 months":"1 year"} · +{order.addedSeats} seats → {order.targetSeats} total</p><p>{money(order.totalAmount)} · unit {money(order.unitPrice)} · created {fmt(order.createdAt)}</p><p>Co-term: {fmt(order.coTermStartsAt)} → {fmt(order.coTermEndsAt)}</p>{order.paymentReference?<p>Reference: {order.paymentReference} · paid {fmt(order.paidAt)}</p>:null}{order.status==="PENDING"?<form action={confirmTelecallerPaymentAction} className="employee-form"><input type="hidden" name="orderId" value={order.id}/><label>Verified payment reference<input name="reference" required maxLength={200} placeholder="UPI / bank / transaction reference"/></label><button>Confirm Payment & Activate Seats</button></form>:null}</article>)}{!orders.length?<p>No Telecaller orders.</p>:null}</div>
  </section></main>;
}