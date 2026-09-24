import Link from 'next/link';
import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {AccountIncreaseCalculator} from '../billing-calculator';
import {loadBillingPageData} from '../billing-page-data';

export default async function Page(){
 const {r,e,telecaller,managersEnabled,accountPrices,accountCurrent,isPlus,activePeriod}=await loadBillingPageData();
 if(!r.hasAccount)return <main className="billing-content"><WorkspacePageHeader title="Add Account Package" backHref="/workspace/billing"/><section className="billing-card"><h2>Account subscription not available</h2><p className="muted">This company edition does not include Account packages.</p><Link href="/workspace/billing">← Back to Subscription</Link></section></main>;
 if(isPlus){
  if(!e?.paidActive||!accountCurrent)return <main className="billing-content"><WorkspacePageHeader title="Add Account Package" backHref="/workspace/billing"/><section className="billing-card"><h2>Start or renew Plus first</h2><p className="muted">Mid-term Account package additions require an active Plus subscription.</p><Link href="/workspace/billing/renewal">Open Renewal →</Link></section></main>;
  return <main className="billing-content"><WorkspacePageHeader title="Add Account Package" backHref="/workspace/billing"/><section className="billing-card"><h2>Add Account Package</h2><p className="muted">Increase Account capacity only. Sales-team seat limits stay unchanged.</p><AccountIncreaseCalculator managersEnabled={managersEnabled} adminLimit={e.adminLimit} managerLimit={e.managerLimit} salesLimit={e.salesLimit} telecallerLimit={telecaller?.limit??0} period={activePeriod} currentPackages={Math.max(1,r.account.packageCount)} accountPrice={accountPrices[activePeriod]} endsAt={accountCurrent.endsAt??e.subscription?.endsAt}/></section></main>;
 }
 return <main className="billing-content"><WorkspacePageHeader title="Add Account Package" backHref="/workspace/billing"/><section className="billing-card"><h2>Add Account Package</h2><form action="/workspace/billing/checkout/account" method="GET" className="billing-form"><p className="muted">Add Account packages without opening Sales-team controls.</p><label>Billing period<select name="billingPeriod" defaultValue="SIX_MONTH"><option value="SIX_MONTH">6 Months — ₹{r.account.sixMonthUnitPrice.toLocaleString('en-IN')}</option><option value="YEARLY">1 Year — ₹{r.account.yearlyUnitPrice.toLocaleString('en-IN')}</option></select></label><label>Additional packages<input name="quantity" type="number" min="1" max="100" defaultValue="1"/></label><button>Continue to Checkout</button></form></section></main>;
}
