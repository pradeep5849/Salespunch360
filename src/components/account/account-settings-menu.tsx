"use client";
import Link from "next/link";
import {useState} from "react";
import {AccountIcon} from "./account-icons";
export const ACCOUNT_SETTINGS_MENU=[
 {label:"General",href:"/workspace/account/settings/general"},{label:"Transaction",href:"/workspace/account/settings/transactions"},{label:"Invoice Print",href:"/workspace/account/settings/print-templates"},{label:"Taxes & GST",href:"/workspace/account/tax/settings"},{label:"User Management",href:"/workspace/employees"},{label:"Transaction SMS",href:"/workspace/account/settings/transactions#sms"},{label:"Reminders",href:"/workspace/account/settings/transactions#reminders"},{label:"Party",href:"/workspace/account/settings/custom-fields"},{label:"Item",href:"/workspace/account/inventory/item-settings"},{label:"Multi-Currency",href:"/workspace/account/financial-years"},
] as const;
export function AccountSettingsMenu(){const[q,setQ]=useState("");const rows=ACCOUNT_SETTINGS_MENU.filter(x=>x.label.toLowerCase().includes(q.trim().toLowerCase()));return <><label className="account-settings-search"><AccountIcon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search settings" aria-label="Search settings"/></label><nav className="account-settings-menu" aria-label="Account settings">{rows.map(item=><Link href={item.href} key={item.label}><span><i><AccountIcon name="settings"/></i><strong>{item.label}</strong></span><b aria-hidden>›</b></Link>)}</nav></>}
