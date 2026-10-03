"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AccountIcon} from "@/components/account/account-icons";
import {ACCOUNT_SETTINGS_MENU} from "@/components/account/account-settings-menu";

export function SaleSettingsOverlay(){
 const[open,setOpen]=useState(false);
 useEffect(()=>{
  const handler=(event:MouseEvent)=>{
   const target=event.target as HTMLElement|null;
   if(!target?.closest(".sale-entry-header .sale-gear"))return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setOpen(true);
  };
  document.addEventListener("click",handler,true);
  return()=>document.removeEventListener("click",handler,true);
 },[]);
 return <>
  <style>{`.sale-entry-header .sale-gear{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;min-width:42px!important;padding:0!important;border:0!important;background:transparent!important;color:#22344a!important;font-size:22px!important;line-height:1!important;opacity:1!important;visibility:visible!important}`}</style>
  {open&&<div role="dialog" aria-modal="true" aria-label="Settings" style={{position:"fixed",inset:0,zIndex:120,overflowY:"auto",background:"#fff"}}>
   <header style={{position:"sticky",top:0,zIndex:2,minHeight:64,display:"flex",alignItems:"center",gap:12,padding:"0 18px",borderBottom:"1px solid #e4e9f0",background:"#fff"}}>
    <button type="button" onClick={()=>setOpen(false)} aria-label="Back to Sale" style={{width:40,height:40,border:0,background:"transparent",fontSize:28,color:"#315674",cursor:"pointer"}}>←</button>
    <h1 style={{margin:0,fontSize:24,fontWeight:650,color:"#17283b"}}>Settings</h1>
   </header>
   <nav aria-label="Sale settings" style={{borderTop:"1px solid #e4e9f0"}}>
    {ACCOUNT_SETTINGS_MENU.map(item=><Link key={item.label} href={item.href} style={{minHeight:56,padding:"0 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e4e9f0",color:"#263f55",textDecoration:"none"}}>
     <span style={{display:"flex",alignItems:"center",gap:14}}><i style={{width:26,height:26,display:"grid",placeItems:"center",color:"#71869a"}}><AccountIcon name={item.icon}/></i><span style={{fontSize:17,fontWeight:500}}>{item.label}</span></span>
     <b aria-hidden style={{fontSize:21,fontWeight:500,color:"#a0aab5"}}>›</b>
    </Link>)}
   </nav>
  </div>}
 </>;
}
