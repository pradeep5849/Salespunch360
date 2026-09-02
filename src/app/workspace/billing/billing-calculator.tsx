"use client";
import {useMemo,useState} from "react";
import {createOrderAction} from "@/app/actions/billing";

type Period="MONTHLY"|"SIX_MONTH"|"YEARLY";
type Prices=Record<Period,{manager:number;sales:number}>;
type Employee={id:string;name:string;role:"MANAGER"|"SALES";managerType?:string|null};
const labels:Record<Period,string>={MONTHLY:"Monthly",SIX_MONTH:"6 Months",YEARLY:"Yearly"};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
const seats=(value:string)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(10000,Math.trunc(n))):0};

function RetainEmployees({title,name,employees,requiredCount,selected,onChange}:{title:string;name:string;employees:Employee[];requiredCount:number;selected:string[];onChange:(ids:string[])=>void}){
 return <fieldset className="billing-retain"><legend>{title}</legend><p>Select exactly <strong>{requiredCount}</strong> employee{requiredCount===1?"":"s"} to remain active when the renewed subscription starts.</p>
  {requiredCount===0?<p className="muted">No employees will remain active for this seat type.</p>:employees.map(e=>{const checked=selected.includes(e.id),blocked=!checked&&selected.length>=requiredCount;return <label key={e.id}><input type="checkbox" name={name} value={e.id} checked={checked} disabled={blocked} onChange={()=>onChange(checked?selected.filter(id=>id!==e.id):[...selected,e.id])}/><span>{e.name}{e.role==="MANAGER"&&e.managerType==="MANAGER_ONLY"?" · Manager Only":e.role==="MANAGER"?" · Field Manager":""}</span></label>})}
 </fieldset>;
}

export function BillingCalculator({managersEnabled,managerUsage,salesUsage,prices,isRenewal,activeEmployees}:{managersEnabled:boolean;managerUsage:number;salesUsage:number;prices:Prices;isRenewal:boolean;activeEmployees:Employee[]}){
 const[period,setPeriod]=useState<Period>("MONTHLY");
 const[managerInput,setManagerInput]=useState(String(Math.max(0,managerUsage))),[salesInput,setSalesInput]=useState(String(Math.max(0,salesUsage)));
 const[retainManagers,setRetainManagers]=useState<string[]>([]),[retainSales,setRetainSales]=useState<string[]>([]);
 const managerSeats=seats(managerInput),salesSeats=seats(salesInput),unit=prices[period],managerSubtotal=managerSeats*unit.manager,salesSubtotal=salesSeats*unit.sales,total=managerSubtotal+salesSubtotal;
 const summary=useMemo(()=>({managerSubtotal,salesSubtotal,total}),[managerSubtotal,salesSubtotal,total]);
 const managerReduction=managersEnabled&&managerSeats<managerUsage,salesReduction=salesSeats<salesUsage;
 const managerSelectionValid=!managerReduction||(isRenewal&&retainManagers.length===managerSeats);
 const salesSelectionValid=!salesReduction||(isRenewal&&retainSales.length===salesSeats);
 const canContinue=managerSeats+salesSeats>0&&managerSelectionValid&&salesSelectionValid;
 const managers=activeEmployees.filter(e=>e.role==="MANAGER"),sales=activeEmployees.filter(e=>e.role==="SALES");
 return <form action={createOrderAction} className="billing-form billing-calculator">
  <label>Billing Period<select name="billingPeriod" value={period} onChange={e=>setPeriod(e.target.value as Period)}>{(Object.keys(labels) as Period[]).map(p=><option key={p} value={p}>{labels[p]}</option>)}</select></label>
  {managersEnabled?<label>Manager Seats<div className="billing-seat-row"><input name="managerSeats" type="number" min="0" step="1" max="10000" inputMode="numeric" value={managerInput} onChange={e=>{setManagerInput(e.target.value);setRetainManagers([])}} onBlur={()=>setManagerInput(String(managerSeats))}/><span>{managerSeats} × {money(unit.manager)} = <strong>{money(summary.managerSubtotal)}</strong></span></div></label>:<input name="managerSeats" type="hidden" value="0"/>}
  <label>Sales Seats<div className="billing-seat-row"><input name="salesSeats" type="number" min="0" step="1" max="10000" inputMode="numeric" value={salesInput} onChange={e=>{setSalesInput(e.target.value);setRetainSales([])}} onBlur={()=>setSalesInput(String(salesSeats))}/><span>{salesSeats} × {money(unit.sales)} = <strong>{money(summary.salesSubtotal)}</strong></span></div></label>
  {managerReduction&&(isRenewal?<RetainEmployees title="Managers for next subscription" name="retainManagerUserIds" employees={managers} requiredCount={managerSeats} selected={retainManagers} onChange={setRetainManagers}/>:<p className="form-error">A first paid subscription cannot have fewer Manager seats than the Managers already active.</p>)}
  {salesReduction&&(isRenewal?<RetainEmployees title="Sales employees for next subscription" name="retainSalesUserIds" employees={sales} requiredCount={salesSeats} selected={retainSales} onChange={setRetainSales}/>:<p className="form-error">A first paid subscription cannot have fewer Sales seats than the Sales employees already active.</p>)}
  <div className="billing-total"><span>Total Amount</span><strong>{money(summary.total)}</strong></div>
  <button disabled={!canContinue}>Continue / Create Order</button>
 </form>;
}
