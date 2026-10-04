"use client";

import Link from "next/link";
import {useMemo, useState} from "react";
import {AccountIcon} from "./account-icons";
import {ACCOUNT_SETTINGS_MENU} from "./account-settings-menu";

export function AccountSettingsScreen(){
 const [searchOpen,setSearchOpen]=useState(false);
 const [query,setQuery]=useState("");
 const items=useMemo(()=>{
  const value=query.trim().toLowerCase();
  return value?ACCOUNT_SETTINGS_MENU.filter(item=>item.label.toLowerCase().includes(value)):ACCOUNT_SETTINGS_MENU;
 },[query]);
 return <section style={{width:"100%",maxWidth:760,margin:"0 auto",background:"#fff",minHeight:"100%"}}>
  <header style={{display:"flex",alignItems:"center",gap:14,minHeight:72,padding:"0 18px",background:"#e9f4ff",borderBottom:"1px solid #dbe5ee"}}>
   <Link href="/workspace/account" aria-label="Back from Settings" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:42,height:42,textDecoration:"none",fontSize:30,lineHeight:1,color:"#315569"}}>←</Link>
   <h1 style={{margin:0,flex:1,fontSize:24,fontWeight:600,color:"#294c5d"}}>Settings</h1>
   <button type="button" aria-label={searchOpen?"Close settings search":"Search settings"} onClick={()=>{setSearchOpen(value=>!value);if(searchOpen)setQuery("")}} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:44,height:44,border:0,background:"transparent",padding:0,cursor:"pointer",color:"#294c5d"}}>
    <span style={{width:29,height:29,display:"inline-flex"}}><AccountIcon name={searchOpen?"close":"search"}/></span>
   </button>
  </header>
  {searchOpen&&<div style={{padding:"10px 16px",background:"#f7fbff",borderBottom:"1px solid #e0e6eb"}}><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search settings" aria-label="Search settings" style={{width:"100%",height:44,border:"1px solid #cad5df",borderRadius:8,padding:"0 12px",fontSize:16,boxSizing:"border-box",outline:"none"}}/></div>}
  <nav aria-label="Account settings" style={{width:"100%"}}>
   {items.map(item=><Link key={item.label} href={item.href} aria-label={`Open ${item.label} settings`} style={{display:"flex",alignItems:"center",minHeight:74,padding:"0 22px 0 28px",borderBottom:"1px solid #e0e0e0",textDecoration:"none",color:"#294c5d",background:"#fff"}}>
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:34,height:34,marginRight:22,color:"#7890a3",flex:"0 0 auto"}}><AccountIcon name={item.icon}/></span>
    <span style={{flex:1,fontSize:20,fontWeight:400,lineHeight:1.25}}>{item.label}</span>
    <span aria-hidden style={{fontSize:34,fontWeight:300,lineHeight:1,color:"#a0a0a0"}}>›</span>
   </Link>)}
   {items.length===0&&<p style={{margin:0,padding:24,color:"#60788f",fontSize:16}}>No settings found.</p>}
  </nav>
 </section>;
}
