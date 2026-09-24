import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from '@/lib/billing/account-package';
import {PLUS_ORDER_PROVIDER} from '@/lib/billing/combined-order';
import {loadBillingPageData} from '../billing-page-data';

export default async function Page(){
 const {r}=await loadBillingPageData();
 return <main className="billing-content"><WorkspacePageHeader title="Payment History" backHref="/workspace/billing"/><section className="billing-card">{r.orders.length===0&&<p className="muted">No orders yet.</p>}{r.orders.map(o=><article className="history-row" key={o.id}><div><strong>{o.provider===ACCOUNT_PACKAGE_ORDER_PROVIDER?`${o.accountPackages||o.adminSeats} Account package${(o.accountPackages||o.adminSeats)===1?'':'s'} · ${o.billingPeriod}`:o.provider===PLUS_ORDER_PROVIDER?`${o.billingPeriod} · ${o.adminSeats} Admin / ${o.managerSeats} Manager / ${o.salesSeats} Sales + ${o.accountPackages} Account package${o.accountPackages===1?'':'s'}`:`${o.billingPeriod} · ${o.adminSeats} Admin / ${o.managerSeats} Manager / ${o.salesSeats} Sales team`}</strong><span>{o.createdAt.toLocaleString('en-IN')} · Ref {o.id.slice(0,8)}</span></div><b>{o.currency} {o.totalAmount.toFixed(2)} · {o.status}</b></article>)}</section></main>;
}
