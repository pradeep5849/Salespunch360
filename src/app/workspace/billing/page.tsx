import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {billingDashboard} from "@/lib/billing/service";
import {BillingCalculator} from "./billing-calculator";

export default async function Page(){
 const r=await billingDashboard(),e=r.entitlement,managersEnabled=r.company?.teamStructure==="MANAGERS_AND_SALES";
 const price=(role:"MANAGER"|"SALES",period:"MONTHLY"|"SIX_MONTH"|"YEARLY",fallback:number)=>Number(r.prices.find(p=>p.role===role&&p.period===period)?.amount??fallback);
 const prices={
  MONTHLY:{manager:price("MANAGER","MONTHLY",200),sales:price("SALES","MONTHLY",150)},
  SIX_MONTH:{manager:price("MANAGER","SIX_MONTH",1100),sales:price("SALES","SIX_MONTH",800)},
  YEARLY:{manager:price("MANAGER","YEARLY",2100),sales:price("SALES","YEARLY",1500)}
 };
 return <main className="billing-content"><WorkspacePageHeader title="Billing & Subscription" backHref="/workspace"/>
  <p className="muted">Company Admin is free. Choose a billing period and the number of Manager and Sales seats. On renewal, you may reduce seats and choose which employees remain active for the next period.</p>
  <section className="billing-summary"><article><strong>{e.state}</strong><span>Effective access</span></article>{managersEnabled&&<article><strong>{e.managerUsage} / {e.managerLimit}</strong><span>Manager seats</span></article>}<article><strong>{e.salesUsage} / {e.salesLimit}</strong><span>Sales seats</span></article><article><strong>{e.subscription?.endsAt?.toLocaleDateString("en-IN")||r.company?.trialEndsAt?.toLocaleDateString("en-IN")||"—"}</strong><span>Access ends</span></article></section>
  <section className="billing-card"><h2>Choose your plan</h2><BillingCalculator managersEnabled={managersEnabled} managerUsage={e.managerUsage} salesUsage={e.salesUsage} prices={prices} isRenewal={e.paidActive} activeEmployees={r.activeEmployees as {id:string;name:string;role:"MANAGER"|"SALES";managerType?:string|null}[]}/></section>
  <section className="billing-card"><h2>Order & payment history</h2>{r.orders.map(o=><article className="history-row" key={o.id}><div><strong>{o.billingPeriod} · {managersEnabled?`${o.managerSeats} Manager / `:""}{o.salesSeats} Sales</strong><span>{o.createdAt.toLocaleString("en-IN")} · Ref {o.id.slice(0,8)}</span></div><b>{o.currency} {o.totalAmount.toFixed(2)} · {o.status}</b></article>)}{!r.orders.length&&<p className="muted">No billing orders yet.</p>}</section>
 </main>;
}
