import Link from 'next/link';
import {redirect} from 'next/navigation';
import {billingDashboard} from '@/lib/billing/service';
import {createOrderAction} from '@/app/actions/billing';
import {ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR,ACCOUNT_PACKAGE_YEARLY_PRICE_INR} from '@/lib/billing/account-package';

type Search=Promise<Record<string,string|string[]|undefined>>;
const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
const count=(v:string|string[]|undefined)=>Math.max(0,Math.trunc(Number(one(v)??0))||0);
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

export default async function Page({searchParams}:{searchParams:Search}){
 const q=await searchParams,r=await billingDashboard();if(!r.hasSales)redirect('/workspace/billing');
 const period=one(q.billingPeriod);if(period!=='SIX_MONTH'&&period!=='YEARLY')redirect('/workspace/billing');
 const admin=count(q.adminSeats),manager=count(q.managerSeats),sales=count(q.salesSeats);if(manager+sales===0)redirect('/workspace/billing');
 const price=(role:'ADMIN'|'MANAGER'|'SALES')=>Number(r.prices.find(p=>p.role===role&&p.period===period)?.amount??0);
 const salesTotal=admin*price('ADMIN')+manager*price('MANAGER')+sales*price('SALES');
 const isPlus=r.company?.productEdition==='SALESPUNCH360_PLUS',accountPackages=isPlus?Math.max(1,count(q.accountPackages)||1):0;
 const accountUnit=isPlus?Number(r.prices.find(p=>p.role==='ACCOUNT_PACKAGE'&&p.period===period)?.amount??(period==='SIX_MONTH'?ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR:ACCOUNT_PACKAGE_YEARLY_PRICE_INR)):0,accountTotal=accountPackages*accountUnit,total=salesTotal+accountTotal;
 const retainAdmin=(Array.isArray(q.retainAdminUserIds)?q.retainAdminUserIds:q.retainAdminUserIds?[q.retainAdminUserIds]:[]),retainManager=(Array.isArray(q.retainManagerUserIds)?q.retainManagerUserIds:q.retainManagerUserIds?[q.retainManagerUserIds]:[]),retainSales=(Array.isArray(q.retainSalesUserIds)?q.retainSalesUserIds:q.retainSalesUserIds?[q.retainSalesUserIds]:[]);
 return <main className="billing-content"><div className="billing-card"><p className="eyebrow">Checkout</p><h1>Review subscription</h1><div className="billing-summary"><article><strong>{period.replace('_',' ')}</strong><span>Billing period</span></article><article><strong>{admin}</strong><span>Additional Admin</span></article><article><strong>{manager}</strong><span>Manager</span></article><article><strong>{sales}</strong><span>Sales</span></article>{isPlus&&<article><strong>{accountPackages}</strong><span>Account package{accountPackages===1?'':'s'} (required for Plus)</span></article>}</div><div className="billing-total"><span>Sales subtotal</span><strong>{money(salesTotal)}</strong></div>{isPlus&&<div className="billing-total"><span>Account subtotal</span><strong>{money(accountTotal)}</strong></div>}<div className="billing-total"><span>Grand Total</span><strong>{money(total)}</strong></div></div><section className="billing-card"><h2>Payment method</h2><article className="history-row"><div><strong>Online Payment</strong><span>Payment gateway integration will be available here.</span></div><button disabled>Coming Soon</button></article><article className="history-row"><div><strong>Manual Payment</strong><span>Create one payment request for the complete subscription.</span></div><form action={createOrderAction}>{[...retainAdmin.map(v=>['retainAdminUserIds',v]),...retainManager.map(v=>['retainManagerUserIds',v]),...retainSales.map(v=>['retainSalesUserIds',v])].map(([name,value],i)=><input key={i} type="hidden" name={name} value={value}/>)}<input type="hidden" name="billingPeriod" value={period}/><input type="hidden" name="adminSeats" value={admin}/><input type="hidden" name="managerSeats" value={manager}/><input type="hidden" name="salesSeats" value={sales}/>{isPlus&&<input type="hidden" name="accountPackages" value={accountPackages}/>}<input type="hidden" name="paymentMethod" value="MANUAL"/><button>Continue with Manual Payment</button></form></article><Link href="/workspace/billing">← Change package</Link></section></main>
}