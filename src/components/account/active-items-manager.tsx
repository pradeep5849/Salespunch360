"use client";
import Link from "next/link";
import {useMemo,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {setItemsActiveAction} from "@/app/actions/account-masters";
type Row={id:string;name:string;code:string|null;stock:number|null};
export function ActiveItemsManager({activate,products,services}:{activate:boolean;products:Row[];services:Row[]}){
 const router=useRouter(),[kind,setKind]=useState<"products"|"services">("products"),[q,setQ]=useState(""),[selected,setSelected]=useState<Set<string>>(new Set()),[pending,startTransition]=useTransition();
 const rows=kind==="products"?products:services,visible=useMemo(()=>rows.filter(x=>`${x.name} ${x.code??""}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);
 const toggle=(id:string)=>setSelected(old=>{const n=new Set(old);n.has(id)?n.delete(id):n.add(id);return n});
 const allVisible=visible.length>0&&visible.every(x=>selected.has(x.id));
 const submit=()=>startTransition(async()=>{await setItemsActiveAction(kind,[...selected],activate);router.push("/workspace/account/inventory");router.refresh()});
 return <main className="active-items-page">
  <header className="items-manager-header"><Link href="/workspace/account/inventory">←</Link><h1>{activate?"Inactive Items":"Active Items"}</h1><span/></header>
  <div className="active-kind"><label><input type="radio" checked={kind==="products"} onChange={()=>{setKind("products");setSelected(new Set())}}/> Products</label><label><input type="radio" checked={kind==="services"} onChange={()=>{setKind("services");setSelected(new Set())}}/> Services</label></div>
  <div className="manager-search">⌕<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by Name or Code"/></div>
  {visible.length>0&&<label className="active-select-all"><input type="checkbox" checked={allVisible} onChange={e=>setSelected(old=>{const n=new Set(old);visible.forEach(x=>e.target.checked?n.add(x.id):n.delete(x.id));return n})}/> Select All</label>}
  <div className="active-items-list">{visible.map(x=><label key={x.id}><input type="checkbox" checked={selected.has(x.id)} onChange={()=>toggle(x.id)}/><span>{x.name}</span><b>{x.stock===null?"":x.stock.toFixed(1)}</b></label>)}</div>
  {!visible.length&&activate&&<div className="active-empty"><div>□</div><p>There are no Inactive Items yet.</p></div>}
  {!visible.length&&!activate&&<div className="active-empty"><p>No active {kind==="products"?"products":"services"} found.</p></div>}
  <footer className="manager-bottom-actions"><Link href="/workspace/account/inventory">Cancel</Link><button disabled={!selected.size||pending} onClick={submit}>{pending?"Saving…":activate?"Mark as Active":"Mark as Inactive"}</button></footer>
 </main>
}