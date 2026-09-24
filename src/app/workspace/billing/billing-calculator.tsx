'use client';
import {useState,type FormEvent} from 'react';
import styles from './billing-calculator.module.css';

type Period='SIX_MONTH'|'YEARLY';
type Prices=Record<Period,{admin:number;manager:number;sales:number}>;
type TelecallerPrices=Record<Period,number>;
type AccountPrices=Record<Period,number>;
type Employee={id:string;name:string;salesRole:'ADMIN'|'MANAGER'|'SALES';managerType?:string|null};
const labels:Record<Period,string>={SIX_MONTH:'6 Months',YEARLY:'Yearly'};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const clamp=(n:number)=>Math.max(0,Math.min(10000,Math.trunc(n)||0));
const packageCount=(value:string)=>Math.max(1,Math.min(100,Math.trunc(Number(value))||1));
const packageContents=(count:number)=>`${count} package${count===1?'':'s'} = ${count} Account Admin, ${count} Accountant, ${count} Project Manager, ${count} Data Entry`;

function Retain({role,count,employees}:{role:Employee['salesRole'];count:number;employees:Employee[]}){
 return <fieldset className="billing-retain"><legend>Choose {count} {role.toLowerCase()} user{count===1?'':'s'} to retain (optional)</legend><p>Leave all unchecked to retain the oldest active users automatically, or choose exactly {count} user{count===1?'':'s'} to keep when the renewed term starts.</p>{employees.filter(e=>e.salesRole===role).map(e=><label key={e.id}><input type="checkbox" name={`retain${role==='ADMIN'?'Admin':role==='MANAGER'?'Manager':'Sales'}UserIds`} value={e.id}/>{e.name}</label>)}</fieldset>;
}

export function AddTeamCalculator({managersEnabled,adminLimit,managerLimit,salesLimit,telecallerLimit=0,period,prices,telecallerPrices={SIX_MONTH:600,YEARLY:1000},isPlus=false,accountPackages=1,endsAt}:{managersEnabled:boolean;adminLimit:number;managerLimit:number;salesLimit:number;telecallerLimit?:number;period:Period;prices:Prices;telecallerPrices?:TelecallerPrices;isPlus?:boolean;accountPackages?:number;endsAt?:Date|null}){
 const[addAdmin,setAddAdmin]=useState(0),[addManager,setAddManager]=useState(0),[addSales,setAddSales]=useState(0),[addTelecaller,setAddTelecaller]=useState(0);
 const adminTarget=adminLimit+addAdmin,managerTarget=managersEnabled?managerLimit+addManager:0,salesTarget=salesLimit+addSales,telecallerTarget=telecallerLimit+addTelecaller,hasAddition=addAdmin+addManager+addSales+addTelecaller>0,p=prices[period];
 return <form action="/workspace/billing/checkout" method="GET" className="billing-form billing-calculator">
  <input type="hidden" name="purchaseMode" value="ADD_TEAM"/><input type="hidden" name="billingPeriod" value={period}/><input type="hidden" name="adminSeats" value={adminTarget}/><input type="hidden" name="managerSeats" value={managerTarget}/><input type="hidden" name="salesSeats" value={salesTarget}/><input type="hidden" name="telecallerSeats" value={telecallerTarget}/>{isPlus&&<input type="hidden" name="accountPackages" value={Math.max(1,accountPackages)}/>} 
  <p className="muted">Add Admin, Manager, Sales or Telecaller seats to the current team without renewing. Only added seats are charged for the remaining time and every Sales-team seat keeps the same expiry date.</p>
  <div className="billing-total"><span>Current billing period</span><strong>{labels[period]}</strong></div>{endsAt&&<div className="billing-total"><span>Common Sales-team expiry</span><strong>{endsAt.toLocaleDateString('en-IN')}</strong></div>}
  <div className="included-admin"><strong>Primary Admin</strong><span>Included / Free</span></div>
  <label>Add Additional Admin Seats<input type="number" min="0" max="10000" value={addAdmin} onChange={e=>setAddAdmin(clamp(Number(e.target.value)))}/><span>{money(p.admin)} full-period rate each · new total {adminTarget}</span></label>
  {managersEnabled?<label>Add Manager Seats<input type="number" min="0" max="10000" value={addManager} onChange={e=>setAddManager(clamp(Number(e.target.value)))}/><span>{money(p.manager)} full-period rate each · new total {managerTarget}</span></label>:null}
  <label>Add Sales Seats<input type="number" min="0" max="10000" value={addSales} onChange={e=>setAddSales(clamp(Number(e.target.value)))}/><span>{money(p.sales)} full-period rate each · new total {salesTarget}</span></label>
  <label>Add Telecaller Seats<input type="number" min="0" max="10000" value={addTelecaller} onChange={e=>setAddTelecaller(clamp(Number(e.target.value)))}/><span>{money(telecallerPrices[period])} full-period rate each · new total {telecallerTarget}</span></label>
  {isPlus&&<p className="muted">Your existing {Math.max(1,accountPackages)} Account package{Math.max(1,accountPackages)===1?'':'s'} stay unchanged and are not added again.</p>}
  {!hasAddition&&<p className="muted">Enter at least one additional team seat to continue.</p>}<button disabled={!hasAddition}>Review Prorated Price</button>
 </form>;
}

export function AccountIncreaseCalculator({managersEnabled,adminLimit,managerLimit,salesLimit,telecallerLimit=0,period,currentPackages,accountPrice,endsAt}:{managersEnabled:boolean;adminLimit:number;managerLimit:number;salesLimit:number;telecallerLimit?:number;period:Period;currentPackages:number;accountPrice:number;endsAt?:Date|null}){
 const[addPackages,setAddPackages]=useState(0),safeCurrent=Math.max(1,currentPackages),targetPackages=safeCurrent+addPackages,managerTarget=managersEnabled?managerLimit:0;
 return <form action="/workspace/billing/checkout" method="GET" className="billing-form billing-calculator">
  <input type="hidden" name="purchaseMode" value="ADD_ACCOUNT"/><input type="hidden" name="billingPeriod" value={period}/><input type="hidden" name="adminSeats" value={adminLimit}/><input type="hidden" name="managerSeats" value={managerTarget}/><input type="hidden" name="salesSeats" value={salesLimit}/><input type="hidden" name="telecallerSeats" value={telecallerLimit}/><input type="hidden" name="accountPackages" value={targetPackages}/>
  <p className="muted">Increase Account capacity during the current Plus term without renewing. Only the newly added Account packages are charged for the remaining time and the existing expiry date stays unchanged.</p>
  <div className="billing-total"><span>Current Account packages</span><strong>{safeCurrent}</strong></div><div className="billing-total"><span>Current billing period</span><strong>{labels[period]}</strong></div>{endsAt&&<div className="billing-total"><span>Current expiry</span><strong>{endsAt.toLocaleDateString('en-IN')}</strong></div>}
  <label>Add Account Packages<input type="number" min="0" max={Math.max(0,100-safeCurrent)} value={addPackages} onChange={e=>setAddPackages(Math.min(Math.max(0,100-safeCurrent),clamp(Number(e.target.value))))}/><span>{money(accountPrice)} full-period rate per package · new total {targetPackages}</span></label>
  <p className="muted">{packageContents(targetPackages)}. Sales Admin, Manager, Sales and Telecaller seat limits stay unchanged.</p>
  {addPackages<1&&<p className="muted">Enter at least one additional Account package to continue.</p>}<button disabled={addPackages<1}>Review Prorated Price</button>
 </form>;
}

export function BillingCalculator({managersEnabled,adminUsage,managerUsage,salesUsage,telecallerUsage=0,telecallerLimit=0,prices,telecallerPrices={SIX_MONTH:600,YEARLY:1000},isRenewal,activeEmployees,isPlus=false,accountPackages=1,accountPrices={SIX_MONTH:400,YEARLY:700},initialAdminSeats,initialManagerSeats,initialSalesSeats}:{managersEnabled:boolean;adminUsage:number;managerUsage:number;salesUsage:number;telecallerUsage?:number;telecallerLimit?:number;prices:Prices;telecallerPrices?:TelecallerPrices;isRenewal:boolean;activeEmployees:Employee[];isPlus?:boolean;accountPackages?:number;accountPrices?:AccountPrices;initialAdminSeats?:number;initialManagerSeats?:number;initialSalesSeats?:number}){
 const[period,setPeriod]=useState<Period>('SIX_MONTH');
 const[admin,setAdmin]=useState(initialAdminSeats??adminUsage);
 const[manager,setManager]=useState(initialManagerSeats??managerUsage);
 const[sales,setSales]=useState(initialSalesSeats??salesUsage);
 const[telecaller,setTelecaller]=useState(Math.max(telecallerUsage,telecallerLimit));
 const[accounts,setAccounts]=useState(String(Math.max(1,accountPackages)));
 const[selectionError,setSelectionError]=useState('');
 const p=prices[period];
 const accountsValue=packageCount(accounts);
 const salesSubtotal=admin*p.admin+manager*p.manager+sales*p.sales;
 const telecallerSubtotal=telecaller*telecallerPrices[period];
 const accountSubtotal=isPlus?accountsValue*accountPrices[period]:0;
 const total=salesSubtotal+telecallerSubtotal+accountSubtotal;
 const hasSalesProduct=manager+sales>0;
 const initialReduction=!isRenewal&&(admin<adminUsage||(managersEnabled&&manager<managerUsage)||sales<salesUsage||telecaller<telecallerUsage);
 const validateRetention=(event:FormEvent<HTMLFormElement>)=>{
  setSelectionError('');
  if(telecaller<telecallerUsage){event.preventDefault();setSelectionError('Telecaller seats cannot be below active Telecallers. Deactivate the Telecaller first, then renew.');return}
  if(initialReduction){event.preventDefault();setSelectionError('Selected seats cannot be below current active users before a paid renewal. Keep enough seats for the active team.');return}
  if(!isRenewal)return;
  const form=new FormData(event.currentTarget),checks:[string,number,boolean][]=[['retainAdminUserIds',admin,admin<adminUsage],['retainManagerUserIds',manager,managersEnabled&&manager<managerUsage],['retainSalesUserIds',sales,sales<salesUsage]];
  for(const[name,count,reducing]of checks){if(!reducing)continue;const selected=form.getAll(name).length;if(selected!==0&&selected!==count){event.preventDefault();setSelectionError(`For a seat reduction, leave the retention choice empty for automatic retention or select exactly ${count} user${count===1?'':'s'}.`);return}}
 };

 return <form action="/workspace/billing/checkout" method="GET" className={`billing-form billing-calculator ${isPlus?styles.plusForm:''}`} onSubmit={validateRetention}>
  <input type="hidden" name="purchaseMode" value={isRenewal?'RENEW':'NEW'}/>
  {isPlus?<>
   <div className={`${styles.plusRow} ${styles.periodRow}`}><strong>Billing Period</strong><select name="billingPeriod" value={period} onChange={e=>setPeriod(e.target.value as Period)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div className={styles.plusSection}><strong className={styles.plusHeading}>Account Package</strong><div className={styles.plusRow}><span>Packages</span><select name="accountPackages" value={String(accountsValue)} onChange={e=>setAccounts(e.target.value)}>{Array.from({length:100},(_,i)=>i+1).map(count=><option key={count} value={count}>{count}</option>)}</select><b>{money(accountPrices[period])} / package</b></div><span className="muted">({packageContents(accountsValue)})</span></div>
   <div className={styles.plusSection}><strong className={styles.plusHeading}>Sales Team</strong><label className={styles.plusRow}><span>Additional Admin</span><input name="adminSeats" type="number" min="0" max="10000" value={admin} onChange={e=>setAdmin(clamp(Number(e.target.value)))}/><span>{money(p.admin)} each</span></label>{managersEnabled?<label className={styles.plusRow}><span>Manager</span><input name="managerSeats" type="number" min="0" max="10000" value={manager} onChange={e=>setManager(clamp(Number(e.target.value)))}/><span>{money(p.manager)} each</span></label>:<input type="hidden" name="managerSeats" value="0"/>}<label className={styles.plusRow}><span>Sales</span><input name="salesSeats" type="number" min="0" max="10000" value={sales} onChange={e=>setSales(clamp(Number(e.target.value)))}/><span>{money(p.sales)} each</span></label><label className={styles.plusRow}><span>Telecaller</span><input name="telecallerSeats" type="number" min={telecallerUsage} max="10000" value={telecaller} onChange={e=>setTelecaller(clamp(Number(e.target.value)))}/><span>{money(telecallerPrices[period])} each</span></label></div>
  </>:<>
   <label>Billing Period<select name="billingPeriod" value={period} onChange={e=>setPeriod(e.target.value as Period)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <div className="included-admin"><strong>Primary Admin</strong><span>Included / Free</span></div>
   <label>Additional Admin Seats<input name="adminSeats" type="number" min="0" max="10000" value={admin} onChange={e=>setAdmin(clamp(Number(e.target.value)))}/><span>{money(p.admin)} each</span></label>
   {managersEnabled?<label>Manager Seats<input name="managerSeats" type="number" min="0" max="10000" value={manager} onChange={e=>setManager(clamp(Number(e.target.value)))}/><span>{money(p.manager)} each</span></label>:<input type="hidden" name="managerSeats" value="0"/>}
   <label>Sales Seats<input name="salesSeats" type="number" min="0" max="10000" value={sales} onChange={e=>setSales(clamp(Number(e.target.value)))}/><span>{money(p.sales)} each</span></label>
   <label>Telecaller Seats<input name="telecallerSeats" type="number" min={telecallerUsage} max="10000" value={telecaller} onChange={e=>setTelecaller(clamp(Number(e.target.value)))}/><span>{money(telecallerPrices[period])} each</span></label>
  </>}
  {isRenewal&&admin<adminUsage&&<Retain role="ADMIN" count={admin} employees={activeEmployees}/>} {isRenewal&&manager<managerUsage&&<Retain role="MANAGER" count={manager} employees={activeEmployees}/>} {isRenewal&&sales<salesUsage&&<Retain role="SALES" count={sales} employees={activeEmployees}/>}<p className="muted">{isRenewal?'Renew the active Sales Admin, Manager, Sales and Telecaller seats together on one common term. Use Add Team for mid-term additions.':'Choose the starting Sales team for the new subscription.'}</p><div className="billing-total"><span>Sales Subtotal</span><strong>{money(salesSubtotal)}</strong></div><div className="billing-total"><span>Telecaller Subtotal</span><strong>{money(telecallerSubtotal)}</strong></div>{isPlus&&<div className="billing-total"><span>Account Subtotal</span><strong>{money(accountSubtotal)}</strong></div>}<div className="billing-total"><span>Total</span><strong>{money(total)}</strong></div>{!hasSalesProduct&&<p className="form-error">Choose at least one Manager or Sales seat to keep Sales active. With no Manager/Sales seats, renew as Account-only.</p>}{selectionError&&<p className="form-error">{selectionError}</p>}<button disabled={!hasSalesProduct||initialReduction}>Continue to Checkout</button>
 </form>;
}
