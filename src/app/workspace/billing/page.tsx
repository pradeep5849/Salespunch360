import Link from 'next/link';
import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {loadBillingPageData,orderErrors} from './billing-page-data';

type Search=Promise<Record<string,string|string[]|undefined>>;
const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
const hubGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14} as const;
const hubButton={display:'grid',placeItems:'center',minHeight:92,padding:'18px',borderRadius:14,background:'#2563eb',color:'#fff',fontWeight:800,fontSize:18,textDecoration:'none',textAlign:'center' as const} as const;

export default async function Page({searchParams}:{searchParams:Search}){
 const q=await searchParams,orderError=one(q.orderError);
 const {backHref}=await loadBillingPageData();
 return <main className="billing-content"><WorkspacePageHeader title="Billing & Subscription" backHref={backHref}/>
  {orderError&&<section className="billing-card"><p className="form-error">{orderErrors[orderError]??orderErrors.ORDER_CREATE_FAILED}</p></section>}
  <section className="billing-card"><div style={hubGrid}><Link href="/workspace/billing/subscription" style={hubButton}>Subscription</Link><Link href="/workspace/billing/actions" style={hubButton}>Billing</Link></div></section>
 </main>;
}
