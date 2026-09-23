"use client";
import {useState,useTransition} from "react";
import {saveMonthlyTargetsAction} from "@/app/actions/targets";
import styles from "./monthly-target-row.module.css";

export function MonthlyTargetRow({row,canEdit}:{row:{id:string;name:string;salesRole:string|null;leadTarget:number;wonTarget:number;created:number;won:number;hasTarget:boolean};canEdit:boolean}){
 const[editing,setEditing]=useState(false),[pending,startTransition]=useTransition();
 const save=(formData:FormData)=>startTransition(async()=>{await saveMonthlyTargetsAction(formData);setEditing(false)});
 return <form action={save} className={`monthly-target-row ${styles.row}`}>
  <input type="hidden" name="assignedUserId" value={row.id}/>
  <div className={styles.employee}><strong>{row.name}</strong><small>{row.salesRole==="MANAGER"?"Field Manager":"Sales"}</small></div>
  <div className={styles.mobileHeader} aria-hidden="true"><span>Type</span><span>Target</span></div>
  <div className={`target-metric ${styles.metric}`}><small>Leads</small>{canEdit&&editing?<input aria-label="Leads target" name="leadTarget" type="number" min="0" step="1" defaultValue={row.leadTarget}/>:<strong>{row.leadTarget}</strong>}<span>Actual {row.created}</span></div>
  <div className={`target-metric ${styles.metric}`}><small>Leads won</small>{canEdit&&editing?<input aria-label="Leads won target" name="wonTarget" type="number" min="0" step="1" defaultValue={row.wonTarget}/>:<strong>{row.wonTarget}</strong>}<span>Actual {row.won}</span></div>
  {canEdit&&!editing&&<button className={styles.action} type="button" onClick={()=>setEditing(true)}>Edit</button>}
  {canEdit&&editing&&<div className={styles.action}><button type="submit" disabled={pending}>{pending?"Saving…":"Save"}</button><button type="button" disabled={pending} onClick={()=>setEditing(false)}>Cancel</button></div>}
 </form>;
}
