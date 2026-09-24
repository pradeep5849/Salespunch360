import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {BillingCalculator} from '../billing-calculator';
import {loadBillingPageData} from '../billing-page-data';

export default async function Page(){
 const {r,e,telecaller,managersEnabled,prices,telecallerPrices,accountPrices,isPlus,activeEmployees}=await loadBillingPageData();
 if(r.hasSales&&e){
  return <main className="billing-content"><WorkspacePageHeader title="Renewal" backHref="/workspace/billing/actions"/><section className="billing-card"><h2>{isPlus?'Plus Renewal':'Sales Renewal'}</h2><p className="muted">Renew the active seats for one new common term. Mid-term additions belong under Add Sales Team or Add Account Team.</p><BillingCalculator managersEnabled={managersEnabled} adminUsage={e.adminUsage} managerUsage={e.managerUsage} salesUsage={e.salesUsage} telecallerUsage={telecaller?.used??0} telecallerLimit={telecaller?.limit??0} prices={prices} telecallerPrices={telecallerPrices} isRenewal={e.paidActive} activeEmployees={activeEmployees} isPlus={isPlus} accountPackages={Math.max(1,r.account.packageCount)} accountPrices={accountPrices} initialAdminSeats={e.paidActive?e.adminLimit:e.adminUsage} initialManagerSeats={e.paidActive?e.managerLimit:e.managerUsage} initialSalesSeats={e.paidActive?e.salesLimit:e.salesUsage}/></section></main>;
 }
 return <main className="billing-content"><WorkspacePageHeader title="Renewal" backHref="/workspace/billing/actions"/><section className="billing-card"><h2>Account Renewal</h2><p className="muted">Renew the current Account package capacity for a new term.</p><form action="/workspace/billing/checkout/account" method="GET" className="billing-form"><label>Billing period<select name="billingPeriod" defaultValue="SIX_MONTH"><option value="SIX_MONTH">6 Months — ₹{r.account.sixMonthUnitPrice.toLocaleString('en-IN')}</option><option value="YEARLY">1 Year — ₹{r.account.yearlyUnitPrice.toLocaleString('en-IN')}</option></select></label><label>Packages<input name="quantity" type="number" min="1" max="100" defaultValue={Math.max(1,r.account.packageCount)}/></label><button>Continue to Checkout</button></form></section></main>;
}
