"use client";

import {useState} from "react";
import {PREFIX_TYPES} from "@/lib/account/transaction-settings";

export function TransactionNumberingFields({branches,initialBranchId,series,children}:{branches:{id:string;name:string}[];initialBranchId:string;series:{branchId:string|null;seriesKey:string;prefix:string}[];children:React.ReactNode}){
 const [branchId,setBranchId]=useState(initialBranchId);
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 return <>
  <label className="transaction-firm"><span>Firm / company branch</span><select name="branchId" value={branchId} onChange={event=>setBranchId(event.target.value)}>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
  {children}
  <section className="transaction-settings-section"><h2>Transaction Prefixes</h2><div>{PREFIX_TYPES.map(([key,label])=>{
   const draftKey=`${branchId}:${key}`;
   return <label className="prefix-row" key={key}><span>{label}</span><input name={`prefix_${key}`} maxLength={30} value={drafts[draftKey]??series.find(row=>row.branchId===branchId&&row.seriesKey===key)?.prefix??""} onChange={event=>setDrafts(current=>({...current,[draftKey]:event.target.value}))} aria-label={`${label} prefix`}/></label>;
  })}</div></section>
 </>;
}
