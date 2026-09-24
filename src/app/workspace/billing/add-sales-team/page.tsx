import Link from 'next/link';
import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {AddTeamCalculator} from '../billing-calculator';
import {loadBillingPageData} from '../billing-page-data';

export default async function Page(){
 const {r,e,telecaller,managersEnabled,prices,telecallerPrices,isPlus,activePeriod}=await loadBillingPageData();
 return <main className="billing-content"><WorkspacePageHeader title="Add Sales Team" backHref="/workspace/billing"/>
  {!r.hasSales||!e?<section className="billing-card"><h2>Sales subscription not available</h2><p className="muted">This company edition does not include Sales-team billing.</p><Link href="/workspace/billing">← Back to Subscription</Link></section>:
  !e.paidActive?<section className="billing-card"><h2>Start the Sales subscription first</h2><p className="muted">Add Sales Team is for mid-term additions. Start or renew the Sales subscription from Renewal.</p><Link href="/workspace/billing/renewal">Open Renewal →</Link></section>:
  <section className="billing-card"><h2>Add Sales Team</h2><p className="muted">Add Additional Admin, Manager, Sales or Telecaller seats. Only the added seats are prorated to the current common expiry date.</p><AddTeamCalculator managersEnabled={managersEnabled} adminLimit={e.adminLimit} managerLimit={e.managerLimit} salesLimit={e.salesLimit} telecallerLimit={telecaller?.limit??0} period={activePeriod} prices={prices} telecallerPrices={telecallerPrices} isPlus={isPlus} accountPackages={Math.max(1,r.account.packageCount)} endsAt={e.subscription?.endsAt}/></section>}
 </main>;
}
