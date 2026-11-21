import Link from 'next/link';
import {loadBillingPageData} from '../billing-page-data';
import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';

const actionGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14} as const;
const blueButton={display:'grid',placeItems:'center',minHeight:88,padding:'18px',borderRadius:14,background:'#2563eb',color:'#fff',fontWeight:800,fontSize:17,textDecoration:'none',textAlign:'center' as const} as const;

export default async function Page(){
 const {r,e,accountCurrent,isPlus}=await loadBillingPageData();
 return <main className="billing-content"><WorkspacePageHeader title="Billing" backHref="/workspace/billing"/>
  <section className="billing-card"><p>Available actions depend on your company edition and active subscription.</p>{!r.hasSales&&<p>Sales-team additions are unavailable for this company edition.</p>}{r.hasSales&&!e?.paidActive&&<p>Start or renew the Sales subscription before adding Sales seats.</p>}{!r.hasAccount&&<p>Account-team additions are unavailable for this company edition.</p>}{isPlus&&(!e?.paidActive||!accountCurrent)&&<p>Renew Plus before adding mid-term Account capacity.</p>}<div style={actionGrid}><Link href="/workspace/billing/add-sales-team" style={blueButton}>Add Sales Team</Link><Link href="/workspace/billing/add-account-team" style={blueButton}>Add Account Team</Link><Link href="/workspace/billing/renewal" style={blueButton}>Renewal</Link></div></section>
 </main>;
}
