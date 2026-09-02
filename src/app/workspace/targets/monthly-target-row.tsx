"use client";
import {useState} from "react";
import {saveMonthlyTargetsAction} from "@/app/actions/targets";

export function MonthlyTargetRow({row,canEdit}:{row:{id:string;name:string;role:string;leadTarget:number;wonTarget:number;created:number;won:number;hasTarget:boolean};canEdit:boolean}){
 const[editing,setEditing]=useState(canEdit&&!row.hasTarget);
 const save=async(formData:FormData)=>{await saveMonthlyTargetsAction(formData);setEditing(false)};
 return <form action={save} className="monthly-target-row">
  <input type="hidden" name="assignedUserId" value={row.id}/>
  <div><strong>{row.name}</strong><small>{row.role==="MANAGER"?"Field Manager":"Sales"}</small></div>
  <div className="target-metric">{canEdit&&editing?<input name="leadTarget" type="number" min="0" step="1" defaultValue={row.leadTarget}/>:<><input type="hidden" name="leadTarget" value={row.leadTarget}/><strong>{row.leadTarget}</strong></>}<span>/ {row.created}</span></div>
  <div className="target-metric">{canEdit&&editing?<input name="wonTarget" type="number" min="0" step="1" defaultValue={row.wonTarget}/>:<><input type="hidden" name="wonTarget" value={row.wonTarget}/><strong>{row.wonTarget}</strong></>}<span>/ {row.won}</span></div>
  {canEdit&&(editing?<button type="submit">Save</button>:<button type="button" onClick={()=>setEditing(true)}>Edit</button>)}
 </form>;
}
