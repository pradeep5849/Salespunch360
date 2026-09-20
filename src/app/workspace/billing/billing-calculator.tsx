'use client';
import {useState} from 'react';

type Period='SIX_MONTH'|'YEARLY';
type Prices=Record<Period,{admin:number;manager:number;sales:number}>;
type AccountPrices=Record<Period,number>;
type Employee={id:string;name:string;salesRole:'ADMIN'|'MANAGER'|'SALES';managerType?:string|null};
const labels:Record<Period,string>={SIX_MONTH:'6 Months',YEARLY:'Yearly'};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const clamp=(n:number)=>Math.max(0,Math.min(10000,Math.trunc(n)||0));
const packageCount=(value:string)=>Math.max(1,Math.min(100,Math.trunc(Number(value))||1));
const packageContents=(count:number)=>`${count} package${count===1?'':'s'} = ${count} Account Admin, ${count} Accountant, ${count} Project Manager, ${count} Data Entry`;

function Retain({role,count,employees}:{role:Employee['salesRole'];count:number;employees:Employee[]}){
 return <fieldset className="billing-retain"><legend>Choose {count} {role.toLowerCase()} user{count===1?'':'s'} to retain (optional)</legend><p>If you do not choose, the oldest active users are retained automatically and the most recently added user(s) are suspended first when the renewed term starts.</p>{employees.filter(e=>e.salesRole===role).map(e=><label key={e.id}><input type="checkbox" name={`retain${role==='ADMIN'?'Admin':role==='MANAGER'?'Manager':'Sales'}UserIds`} value={e.id}/>{e.name}</label>)}</fieldset>;
}

export function BillingCalculator({managersEnabled,adminUsage,managerUsage,salesUsage,prices,isRenewal,activeEmployees,isPlus=false,accountPackages=1,accountPrices={SIX_MONTH:400,YEARLY:700}}:{managersEnabled:boolean;adminUsage:number;managerUsage:number;salesUsage:number;prices:Prices;isRenewal:boolean;activeEmployees:Employee[];isPlus?:boolean;accountPackages?:number;accountPrices?:AccountPrices}){
 const[period,setPeriod]=useState<Period>('SIX_MONTH');
 const[admin,setAdmin]=useState(adminUsage);
 const[manager,setManager]=useState(managerUsage);
 const[sales,setSales]=useState(salesUsage);
 const[accounts,setAccounts]=useState(String(Math.max(1,accountPackages)));
 const p=prices[period];
 const accountsValue=packageCount(accounts);
 const salesSubtotal=admin*p.admin+manager*p.manager+sales*p.sales;
 const accountSubtotal=isPlus?accountsValue*accountPrices[period]:0;
 const total=salesSubtotal+accountSubtotal;
 const hasSalesProduct=manager+sales>0;
 const rowStyle={display:'grid',gridTemplateColumns:'minmax(150px,1fr) 120px minmax(90px,auto)',alignItems:'center',gap:10} as const;
 const sectionStyle={display:'grid',gap:10,padding:'4px 0'} as const;

 return <form action="/workspace/billing/checkout" method="GET" className="billing-form billing-calculator" style={isPlus?{gridTemplateColumns:'1fr',gap:14}:undefined}>
  {isPlus?<>
   <div style={{...rowStyle,gridTemplateColumns:'minmax(150px,1fr) minmax(180px,240px)'}}><strong>Billing Period</strong><select name="billingPeriod" value={period} onChange={e=>setPeriod(e.target.value as Period)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div style={sectionStyle}><strong style={{fontSize:15}}>Account Package</strong><div style={rowStyle}><span>Packages</span><select name="accountPackages" value={String(accountsValue)} onChange={e=>setAccounts(e.target.value)}>{Array.from({length:100},(_,i)=>i+1).map(count=><option key={count} value={count}>{count}</option>)}</select><b>{money(accountPrices[period])}</b></div><span className="muted">({packageContents(accountsValue)})</span></div>
   <div style={sectionStyle}><strong style={{fontSize:15}}>Sales</strong><label style={rowStyle}><span>Admin</span><input name="adminSeats" type="number" min="0" max="10000" value={admin} onChange={e=>setAdmin(clamp(Number(e.target.value)))}/><span>{money(p.admin)} each</span></label>{managersEnabled?<label style={rowStyle}><span>Manager</span><input name="managerSeats" type="number" min="0" max="10000" value={manager} onChange={e=>setManager(clamp(Number(e.target.value)))}/><span>{money(p.manager)} each</span></label>:<input type="hidden" name="managerSeats" value="0"/>}<label style={rowStyle}><span>Sales</span><input name="salesSeats" type="number" min="0" max="10000" value={sales} onChange={e=>setSales(clamp(Number(e.target.value)))}/><span>{money(p.sales)} each</span></label></div>
  </>:<>
   <label>Billing Period<select name="billingPeriod" value={period} onChange={e=>setPeriod(e.target.value as Period)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <div className="included-admin"><strong>Primary Admin</strong><span>Included / Free</span></div>
   <label>Additional Admin Seats<input name="adminSeats" type="number" min="0" max="10000" value={admin} onChange={e=>setAdmin(clamp(Number(e.target.value)))}/><span>{money(p.admin)} each</span></label>
   {managersEnabled?<label>Manager Seats<input name="managerSeats" type="number" min="0" max="10000" value={manager} onChange={e=>setManager(clamp(Number(e.target.value)))}/><span>{money(p.manager)} each</span></label>:<input type="hidden" name="managerSeats" value="0"/>}
   <label>Sales Seats<input name="salesSeats" type="number" min="0" max="10000" value={sales} onChange={e=>setSales(clamp(Number(e.target.value)))}/><span>{money(p.sales)} each</span></label>
  </>}
  {isRenewal&&admin<adminUsage&&<Retain role="ADMIN" count={admin} employees={activeEmployees}/>} {isRenewal&&manager<managerUsage&&<Retain role="MANAGER" count={manager} employees={activeEmployees}/>} {isRenewal&&sales<salesUsage&&<Retain role="SALES" count={sales} employees={activeEmployees}/>}<p className="muted">Adding seats is immediate after payment and prorated to the current expiry. Reductions apply from the next renewal.</p><div className="billing-total"><span>Sales Subtotal</span><strong>{money(salesSubtotal)}</strong></div>{isPlus&&<div className="billing-total"><span>Account Subtotal</span><strong>{money(accountSubtotal)}</strong></div>}<div className="billing-total"><span>Total</span><strong>{money(total)}</strong></div>{!hasSalesProduct&&<p className="form-error">Choose at least one Manager or Sales seat to keep Sales active. With no Manager/Sales seats, renew as Account-only.</p>}<button disabled={!hasSalesProduct}>Continue to Checkout</button>
 </form>;
}
