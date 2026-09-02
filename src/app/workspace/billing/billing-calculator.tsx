"use client";
import {useMemo,useState} from "react";
import {createOrderAction} from "@/app/actions/billing";

type Period="MONTHLY"|"SIX_MONTH"|"YEARLY";
type Prices=Record<Period,{manager:number;sales:number}>;
const labels:Record<Period,string>={MONTHLY:"Monthly",SIX_MONTH:"6 Months",YEARLY:"Yearly"};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

export function BillingCalculator({managersEnabled,managerUsage,salesUsage,prices}:{managersEnabled:boolean;managerUsage:number;salesUsage:number;prices:Prices}){
 const[period,setPeriod]=useState<Period>("MONTHLY"),[managerSeats,setManagerSeats]=useState(Math.max(0,managerUsage)),[salesSeats,setSalesSeats]=useState(Math.max(0,salesUsage));
 const unit=prices[period],managerSubtotal=managerSeats*unit.manager,salesSubtotal=salesSeats*unit.sales,total=managerSubtotal+salesSubtotal;
 const summary=useMemo(()=>({managerSubtotal,salesSubtotal,total}),[managerSubtotal,salesSubtotal,total]);
 return <form action={createOrderAction} className="billing-form billing-calculator">
  <label>Billing Period<select name="billingPeriod" value={period} onChange={e=>setPeriod(e.target.value as Period)}>{(Object.keys(labels) as Period[]).map(p=><option key={p} value={p}>{labels[p]}</option>)}</select></label>
  {managersEnabled?<label>Manager Seats<div className="billing-seat-row"><input name="managerSeats" type="number" min={managerUsage} max="10000" value={managerSeats} onChange={e=>setManagerSeats(Math.max(managerUsage,Number(e.target.value)||0))}/><span>{managerSeats} × {money(unit.manager)} = <strong>{money(summary.managerSubtotal)}</strong></span></div></label>:<input name="managerSeats" type="hidden" value="0"/>}
  <label>Sales Seats<div className="billing-seat-row"><input name="salesSeats" type="number" min={salesUsage} max="10000" value={salesSeats} onChange={e=>setSalesSeats(Math.max(salesUsage,Number(e.target.value)||0))}/><span>{salesSeats} × {money(unit.sales)} = <strong>{money(summary.salesSubtotal)}</strong></span></div></label>
  <div className="billing-total"><span>Total Amount</span><strong>{money(summary.total)}</strong></div>
  <button>Continue / Create Order</button>
 </form>;
}
