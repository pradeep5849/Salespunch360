import Link from 'next/link';
import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';

const actionGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14} as const;
const blueButton={display:'grid',placeItems:'center',minHeight:88,padding:'18px',borderRadius:14,background:'#2563eb',color:'#fff',fontWeight:800,fontSize:17,textDecoration:'none',textAlign:'center' as const} as const;

export default function Page(){
 return <main className="billing-content"><WorkspacePageHeader title="Billing" backHref="/workspace/billing"/>
  <section className="billing-card"><div style={actionGrid}><Link href="/workspace/billing/add-sales-team" style={blueButton}>Add Sales Team</Link><Link href="/workspace/billing/add-account-team" style={blueButton}>Add Account Team</Link><Link href="/workspace/billing/renewal" style={blueButton}>Renewal</Link></div></section>
 </main>;
}
