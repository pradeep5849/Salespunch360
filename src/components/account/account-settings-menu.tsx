"use client";
import Link from "next/link";
import {AccountIcon} from "./account-icons";

export const ACCOUNT_SETTINGS_MENU=[
 {label:"General",href:"/workspace/account/settings/general",icon:"settings"},
 {label:"Transaction",href:"/workspace/account/settings/transactions",icon:"receipt"},
 {label:"Invoice Print",href:"/workspace/account/settings/print-templates",icon:"report"},
 {label:"Taxes & GST",href:"/workspace/account/tax/settings",icon:"tax"},
 {label:"Employees",href:"/workspace/employees",icon:"users"},
 {label:"Transaction SMS",href:"/workspace/account/settings/transaction-sms",icon:"message"},
 {label:"Reminders",href:"/workspace/account/settings/transactions#reminders",icon:"clock"},
 {label:"Party",href:"/workspace/account/settings/party",icon:"party"},
 {label:"Item",href:"/workspace/account/inventory/item-settings",icon:"items"},
 {label:"Multi-Currency",href:"/workspace/account/settings/multi-currency",icon:"currency"},
] as const;

export function AccountSettingsMenu(){
 return <nav className="account-settings-menu" aria-label="Account settings" style={{borderRadius:0,borderLeft:0,borderRight:0,boxShadow:"none"}}>
  {ACCOUNT_SETTINGS_MENU.map(item=><Link href={item.href} key={item.label} aria-label={`Open ${item.label} settings`} style={{minHeight:56,padding:"0 14px"}}>
   <span style={{gap:12}}><i style={{width:28,height:28,borderRadius:0,background:"transparent",color:"#60788f"}}><AccountIcon name={item.icon}/></i><strong style={{fontSize:17,fontWeight:500}}>{item.label}</strong></span>
   <b aria-hidden style={{fontSize:20,fontWeight:500,color:"#9aa7b5"}}>›</b>
  </Link>)}
 </nav>;
}
