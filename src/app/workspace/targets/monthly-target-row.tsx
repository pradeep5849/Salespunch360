"use client";
import {useRouter} from "next/navigation";
import {useState,useTransition} from "react";
import {saveMonthlyTargetsAction} from "@/app/actions/targets";
import styles from "./monthly-target-row.module.css";

export function MonthlyTargetRow({row,canEdit}:{row:{id:string;name:string;salesRole:string|null;leadTarget:number;wonTarget:number;created:number;won:number;hasTarget:boolean;revision:string;actualScope?:string;branchActuals?:{branchId:string;branchName:string;created:number;won:number}[]};canEdit:boolean}){
 const router=useRouter();const[error,setError]=useState<string|null>(null);
 const[editing,setEditing]=useState(false),[pending,startTransition]=useTransition();
 const save=(formData:FormData)=>startTransition(async()=>{setError(null);try{await saveMonthlyTargetsAction(formData);setEditing(false)}catch{setError("Targets could not be saved. Reload current targets before retrying.")}});
 return <form action={save} className={`monthly-target-row ${styles.row}`}>
  <input type="hidden" name="revision" value={row.revision}/><input type="hidden" name="assignedUserId" value={row.id}/>
  {error&&<div role="alert">{error}<button type="button" onClick={()=>{setEditing(false);setError(null);router.refresh()}}>Reload targets</button></div>}
  <div className={styles.employee}><strong>{row.name}</strong><small>{row.salesRole==="MANAGER"?"Field Manager":"Sales"}</small><small>Company target · {row.actualScope==="AUTHORIZED_BRANCHES"?"actuals from accessible records":"company actuals"}</small>{Boolean(row.branchActuals?.length)&&<details data-branch-ui><summary>Actuals by branch</summary>{row.branchActuals?.map(branch=><small key={branch.branchId}>{branch.branchName}: {branch.created} leads · {branch.won} won</small>)}</details>}</div>
  <div className={styles.mobileHeader} aria-hidden="true"><span>Type</span><span>Target</span></div>
  <div className={`target-metric ${styles.metric}`}><small>Leads</small>{canEdit&&editing?<input aria-label="Leads target" name="leadTarget" type="number" min="0" step="1" defaultValue={row.leadTarget}/>:<strong>{row.leadTarget}</strong>}<span>Actual {row.created}</span></div>
  <div className={`target-metric ${styles.metric}`}><small>Leads won</small>{canEdit&&editing?<input aria-label="Leads won target" name="wonTarget" type="number" min="0" step="1" defaultValue={row.wonTarget}/>:<strong>{row.wonTarget}</strong>}<span>Actual {row.won}</span></div>
  {canEdit&&!editing&&<button className={styles.action} type="button" onClick={()=>setEditing(true)}>Edit</button>}
  {canEdit&&editing&&<><button className={styles.action} type="submit" disabled={pending}>{pending?"Saving…":"Save"}</button><button className={styles.action} type="button" disabled={pending} onClick={()=>setEditing(false)}>Cancel</button></>}
 </form>;
}
