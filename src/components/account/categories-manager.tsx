"use client";
import Link from "next/link";
import {useMemo,useState,useTransition} from "react";
import {createAccountCategoryAction} from "@/app/actions/account-masters";
export function CategoriesManager({categories:initial,uncategorizedCount}:{categories:{id:string;name:string;count:number}[];uncategorizedCount:number}){
 const[rows,setRows]=useState(initial),[q,setQ]=useState(""),[open,setOpen]=useState(false),[name,setName]=useState(""),[pending,startTransition]=useTransition();
 const visible=useMemo(()=>rows.filter(x=>x.name.toLowerCase().includes(q.toLowerCase())),[rows,q]);
 const create=()=>{if(!name.trim())return;startTransition(async()=>{const row=await createAccountCategoryAction({name:name.trim(),scope:"BOTH"});setRows(old=>[...old,{id:row.id,name:row.name,count:0}].sort((a,b)=>a.name.localeCompare(b.name)));setName("");setOpen(false)})};
 return <main className="items-manager-page">
  <header className="items-manager-header"><Link href="/workspace/account/inventory" aria-label="Back">←</Link><h1>Categories</h1><Link href="/workspace/account/inventory/item-settings" aria-label="Item settings">⚙</Link></header>
  <div className="manager-search">⌕<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search Category"/></div>
  <div className="manager-table"><div className="manager-table-head"><span>Category Name</span><span>Item Count</span></div><div className="manager-row"><span>Items Not in Any Category</span><b>{uncategorizedCount}</b></div>{visible.map(x=><div className="manager-row" key={x.id}><span>{x.name}</span><b>{x.count}</b></div>)}</div>
  <button className="manager-fab" onClick={()=>setOpen(true)}>⊕ Add Category</button>
  {open&&<div className="sale-more-sheet"><section><header><h2>Add Category</h2><button onClick={()=>setOpen(false)}>×</button></header><div className="manager-sheet-body"><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Enter Category Name"/><button disabled={!name.trim()||pending} onClick={create}>{pending?"Creating…":"Create"}</button></div></section></div>}
 </main>
}