"use client";
import Link from "next/link";
import {AccountIcon} from "./account-icons";
export const ACCOUNT_SETTINGS_MENU=[
 {label:"General",href:"/workspace/account/settings/general",icon:"settings"},{label:"Transaction",href:"/workspace/account/settings/transactions",icon:"receipt"},{label:"Invoice Print",href:"/workspace/account/settings/print-templates",icon:"report"},{label:"Taxes & GST",href:"/workspace/account/tax/settings",icon:"tax"},{label:"Employees",href:"/workspace/employees",icon:"users"},{label:"Transaction SMS",href:"/workspace/account/settings/transaction-sms",icon:"message"},{label:"Reminders",href:"/workspace/account/settings/reminders",icon:"clock"},{label:"Party",href:"/workspace/account/settings/party",icon:"party"},{label:"Item",href:"/workspace/account/inventory/item-settings",icon:"items"},{label:"Multi-Currency",href:"/workspace/account/settings/multi-currency",icon:"currency"},
] as const;
export function AccountSettingsMenu(){return <nav className="account-settings-menu" aria-label="Account settings">{ACCOUNT_SETTINGS_MENU.map(item=><Link href={item.href} key={item.label} aria-label={`Open ${item.label} settings`}><span><i><AccountIcon name={item.icon}/></i><strong>{item.label}</strong></span><b aria-hidden>›</b></Link>)}</nav>}
