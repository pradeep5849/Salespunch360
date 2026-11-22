import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from '@/lib/billing/account-package';
import {PLUS_ORDER_PROVIDER} from '@/lib/billing/combined-order';
import {billingOrderHistory} from '@/lib/billing/service';
import {ListPagination} from '@/components/workspace/list-pagination';

export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){
 const query=await searchParams,history=await billingOrderHistory({page:query.page,pageSize:50});
 return <main className="billing-content"><WorkspacePageHeader title="Payment History" backHref="/workspace/billing"/><section className="billing-card">{history.items.length===0&&<p className="muted">No orders yet.</p>}{history.items.map(o=><article className="history-row" key={o.id}><div><strong>{o.provider===ACCOUNT_PACKAGE_ORDER_PROVIDER?`${o.accountPackages||o.adminSeats} Account package${(o.accountPackages||o.adminSeats)===1?'':'s'} · ${o.billingPeriod}`:o.provider===PLUS_ORDER_PROVIDER?`${o.billingPeriod} · ${o.adminSeats} Admin / ${o.managerSeats} Manager / ${o.salesSeats} Sales + ${o.accountPackages} Account package${o.accountPackages===1?'':'s'}`:`${o.billingPeriod} · ${o.adminSeats} Admin / ${o.managerSeats} Manager / ${o.salesSeats} Sales team`}</strong><span>{o.createdAt.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST · Ref {o.id}</span></div><b>{o.currency} {o.totalAmount.toFixed(2)} · {o.status}</b></article>)}</section><ListPagination path="/workspace/billing/history" query={{}} page={history.page} hasMore={history.hasMore}/></main>;
}
