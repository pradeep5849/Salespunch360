"use client";
import {SaveFeedbackForm,SavePendingFields} from "./save-feedback";
import Link from "next/link";
import {useMemo,useState,useRef} from "react";
import {useFormStatus} from "react-dom";
import styles from "./reminder-settings.module.css";

type Item={id:string;name:string;type:"PRODUCT"|"SERVICE"};
type Props={enabled:boolean;allowSalePeriodOverride:boolean;items:Item[];selectedIds:string[];periodDays:number;message:string;action:(fd:FormData)=>Promise<void>};
export function ServiceReminderPicker({enabled,allowSalePeriodOverride,items,selectedIds,periodDays,message,action}:Props){
 const[days,setDays]=useState(String(periodDays)),[draftMessage,setDraftMessage]=useState(message);
 const preview=useRef<HTMLDialogElement>(null);
 const[tab,setTab]=useState<"ALL"|"PRODUCT"|"SERVICE">("ALL");
 const[query,setQuery]=useState("");
 const[selected,setSelected]=useState(()=>new Set(selectedIds));
 const filtered=useMemo(()=>items.filter(item=>(tab==="ALL"||item.type===tab)&&item.name.toLowerCase().includes(query.trim().toLowerCase())),[items,tab,query]);
 const allVisibleSelected=filtered.length>0&&filtered.every(item=>selected.has(item.id));
 const toggle=(id:string)=>setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});
 const toggleAll=()=>setSelected(current=>{const next=new Set(current);if(allVisibleSelected)filtered.forEach(item=>next.delete(item.id));else filtered.forEach(item=>next.add(item.id));return next});
 return <main className={styles.picker}>
  <header className={styles.header}><Link href="/workspace/account/settings/reminders" aria-label="Back">←</Link><h1>Select Items for Reminders</h1></header>
  <div className={styles.tabs}><button type="button" className={tab==="ALL"?styles.active:""} onClick={()=>setTab("ALL")}>All Items</button><button type="button" className={tab==="PRODUCT"?styles.active:""} onClick={()=>setTab("PRODUCT")}>Products</button><button type="button" className={tab==="SERVICE"?styles.active:""} onClick={()=>setTab("SERVICE")}>Services</button></div>
  <div className={styles.search}><span aria-hidden>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Items" aria-label="Search Items"/></div>
  <SaveFeedbackForm action={action}>
<SavePendingFields>   {[...selected].map(id=><input key={id} type="hidden" name="selectedIds" value={id}/>)}
   <div className={styles.itemBox}>
    <label className={styles.itemRow}><span>Select All</span><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/></label>
    {filtered.map(item=><label className={styles.itemRow} key={item.id}><span>{item.name}</span><input type="checkbox" checked={selected.has(item.id)} onChange={()=>toggle(item.id)}/></label>)}
    {filtered.length===0&&<div className={styles.itemRow}><span>No items found.</span></div>}
   </div>
   <section className={styles.itemBox}><h2>Add Reminder Details</h2><label className={styles.itemRow}>Enable Service Reminders<input type="checkbox" name="enabled" defaultChecked={enabled}/></label><label className={styles.itemRow}>Edit service period for a party while making a sale<input type="checkbox" name="allowSalePeriodOverride" defaultChecked={allowSalePeriodOverride}/></label><label className={styles.detailField}>Service Period (No. of Days)<input aria-label="Service Period (No. of Days)" type="number" name="periodDays" min="1" max="3650" required value={days} onChange={event=>setDays(event.target.value)}/></label><button className={styles.previewButton} type="button" onClick={()=>preview.current?.showModal()}>Preview Reminder Message</button><label className={styles.detailField}>Reminder Message<textarea aria-label="Reminder Message" name="message" required maxLength={2000} value={draftMessage} onChange={event=>setDraftMessage(event.target.value)}/></label><p>Use {'{Party name}'}, {'{Item name}'}, {'{reminder date}'} and {'{Company name}'} in your message. Messages are prepared for manual sending.</p></section></SavePendingFields><ReminderSubmit valid={Number.isInteger(Number(days))&&Number(days)>=1&&Number(days)<=3650&&draftMessage.trim().length>0}/>
  </SaveFeedbackForm>
  <dialog ref={preview} className={styles.previewDialog} aria-labelledby="service-preview-title"><header><h2 id="service-preview-title">Reminder Message</h2><button type="button" aria-label="Close reminder preview" onClick={()=>preview.current?.close()}>×</button></header><p>{draftMessage}</p></dialog>
 </main>;
}

function ReminderSubmit({valid}:{valid:boolean}){const{pending}=useFormStatus();return <button type="submit" disabled={pending||!valid} className={styles.continue}>{pending?"Saving…":"Add Reminder"}</button>}
