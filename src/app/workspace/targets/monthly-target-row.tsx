"use client";
import {saveMonthlyTargetsAction} from "@/app/actions/targets";
import styles from "./monthly-target-row.module.css";

export function MonthlyTargetRow({row,canEdit}:{row:{id:string;name:string;salesRole:string|null;leadTarget:number;wonTarget:number;created:number;won:number;hasTarget:boolean};canEdit:boolean}){
 return <form action={saveMonthlyTargetsAction} className={`monthly-target-row ${styles.row}`}>
  <input type="hidden" name="assignedUserId" value={row.id}/>
  <div className={styles.employee}><strong>{row.name}</strong><small>{row.salesRole==="MANAGER"?"Field Manager":"Sales"}</small></div>
  <div className={styles.mobileHeader} aria-hidden="true"><span>Type</span><span>Target</span></div>
  <div className={`target-metric ${styles.metric}`}><small>Leads</small>{canEdit?<input aria-label="Leads target" name="leadTarget" type="number" min="0" step="1" defaultValue={row.leadTarget}/>:<strong>{row.leadTarget}</strong>}<span>Actual {row.created}</span></div>
  <div className={`target-metric ${styles.metric}`}><small>Leads won</small>{canEdit?<input aria-label="Leads won target" name="wonTarget" type="number" min="0" step="1" defaultValue={row.wonTarget}/>:<strong>{row.wonTarget}</strong>}<span>Actual {row.won}</span></div>
  {canEdit&&<button className={styles.action} type="submit">Save</button>}
 </form>;
}
