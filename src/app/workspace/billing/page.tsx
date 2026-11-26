import {WebPushButton} from './web-push-button';
import Link from 'next/link';
import {requirePermissionForMutation} from '@/lib/auth/authorization';
import {readBillingCart,cartSelectionSchema} from '@/lib/billing/cart';
import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {orderErrors} from './billing-page-data';
import {billingHubContext} from '@/lib/billing/service';

type Search=Promise<Record<string,string|string[]|undefined>>;
const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
const hubGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14} as const;
const hubButton={display:'grid',placeItems:'center',minHeight:92,padding:'18px',borderRadius:14,background:'#2563eb',color:'#fff',fontWeight:800,fontSize:18,textDecoration:'none',textAlign:'center' as const} as const;

export default async function Page({searchParams}:{searchParams:Search}){
 const q=await searchParams,orderError=one(q.orderError);
 const {backHref}=await billingHubContext();
 const actor=await requirePermissionForMutation('SALES_BILLING');
 const cart=actor.companyId?await readBillingCart(actor.companyId):null;
 const cartCount=cartSelectionSchema.safeParse(cart?.selection).success?1:0;
 return <main className="billing-content"><WorkspacePageHeader title="Billing & Subscription" backHref={backHref}/>
  {orderError&&<section className="billing-card"><p className="form-error">{Object.hasOwn(orderErrors,orderError)?orderErrors[orderError]:orderErrors.ORDER_CREATE_FAILED}</p></section>}
  <section className="billing-card"><div style={hubGrid}><Link href="/workspace/billing/subscription" style={hubButton}>Subscription</Link><Link href="/workspace/billing/actions" style={hubButton}>Billing</Link><Link href="/workspace/billing/cart" style={hubButton}>Shopping Cart ({cartCount})</Link><Link href="/workspace/billing/history" style={hubButton}>Payment History</Link></div></section>
  <section className="billing-card"><WebPushButton/></section>
 </main>;
}
