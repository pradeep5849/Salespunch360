"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import styles from "./reminder-settings.module.css";

type Item={id:string;name:string;type:"PRODUCT"|"SERVICE"};
type Props={items:Item[];selectedIds:string[];action:(fd:FormData)=>Promise<void>};
export function ServiceReminderPicker({items,selectedIds,action}:Props){
 const[tab,setTab]=useState<"ALL"|"PRODUCT"|"SERVICE">("ALL");
 const[query,setQuery]=useState("");
 const[selected,setSelected]=useState(()=>new Set(selectedIds));
 const filtered=useMemo(()=>items.filter(item=>(tab==="ALL"||item.type===tab)&&item.name.toLowerCase().includes(query.trim().toLowerCase())),[items,tab,query]);
 const allVisibleSelected=filtered.length>0&&filtered.every(item=>selected.has(item.id));
 const toggle=(id:string)=>setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next});
 const toggleAll=()=>setSelected(current=>{const next=new Set(current);if(allVisibleSelected)filtered.forEach(item=>next.delete(item.id));else filtered.forEach(item=>next.add(item.id));return next});
 return <main className={styles.picker}>
  <header className={styles.header}><Link href="/workspace/account/settings/reminders" aria-label="Back">←</Link><h1>Select Items for Reminders</h1></header>
  <div className={styles.tabs}><button type="button" className={tab==="ALL"?styles.active:""} onClick={()=>setTab("ALL")}>All Items</button><button type="button" className={tab==="PRODUCT"?styles.active:""} onClick={()=>setTab("PRODUCT")}>Products</button><button type="button" className={tab==="SERVICE"?styles.active:""} onClick={()=>setTab("SERVICE")}>Services</button></div>
  <div className={styles.search}><span aria-hidden>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Items" aria-label="Search Items"/></div>
  <form action={action}>
   {[...selected].map(id=><input key={id} type="hidden" name="selectedIds" value={id}/>)}
   <div className={styles.itemBox}>
    <label className={styles.itemRow}><span>Select All</span><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/></label>
    {filtered.map(item=><label className={styles.itemRow} key={item.id}><span>{item.name}</span><input type="checkbox" checked={selected.has(item.id)} onChange={()=>toggle(item.id)}/></label>)}
    {filtered.length===0&&<div className={styles.itemRow}><span>No items found.</span></div>}
   </div>
   <button className={styles.continue} type="submit" disabled={selected.size===0}>Continue</button>
  </form>
 </main>;
}
