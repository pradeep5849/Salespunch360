"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {updateGeneralSettingsAction} from "@/app/actions/account-settings";

type Values={appLanguage:string;baseCurrency:string;displayDecimalPlaces:number;dateFormat:string;warnUnsavedChanges:boolean;appearance:string};
type Info={title:string;what:string;how?:string;why?:string};
const INFO:Record<string,Info>={
 currency:{title:"Business Currency",what:"Selects the primary currency for this SalesPunch360 business.",how:"Its code and symbol are used on applicable Sales, Purchase, Expense, accounting and report screens.",why:"A consistent business currency keeps records and reports comparable."},
 decimals:{title:"Decimal Places",what:"Controls how many digits SalesPunch360 displays after the decimal point.",how:"Applicable on-screen and printed monetary and quantity values follow this display preference.",why:"It changes presentation only; stored accounting values and calculation precision are not reduced."},
 theme:{title:"Theme",what:"Controls the visual style of SalesPunch360.",how:"Standard is the current and only available theme. Trending and Modern are planned for a later release.",why:"Future themes will offer alternative presentation without changing business records."},
 security:{title:"Passcode / Fingerprint",what:"App security helps prevent unauthorized access to business information.",how:"SalesPunch360 currently protects this Web workspace with your authenticated account and password. A separate app passcode or biometric lock is not available here.",why:"Use a strong password and secure your device while platform-specific protection is unavailable."},
 branches:{title:"Multi-Branch",what:"Multi-Branch uses SalesPunch360’s existing company branches—never a separate firm record.",how:"Authorized users can manage branches and work within their permitted branch scope.",why:"It keeps inventory, transactions and reports isolated or consolidated according to existing permissions."},
 warehouse:{title:"Godown / Warehouse & Stock Transfer",what:"Uses the existing SalesPunch360 warehouse and inventory-transfer workflow.",how:"Open it to manage warehouses and validated transfers without creating duplicate stock movements.",why:"Using the existing workflow preserves inventory and accounting controls."},
 backup:{title:"Backup Settings",what:"SalesPunch360 provides an on-demand company backup bundle; automatic application backup scheduling is not currently available.",how:"Open Backup Settings to generate the supported checksum-protected export.",why:"The export complements—but does not replace—your hosting provider’s tested database backups."},
 estimate:{title:"Estimate / Quotation",what:"A non-posting offer of goods, services and prices to a customer.",how:"Use the existing Quotations workflow when the module and your permissions allow it.",why:"It documents an offer before creating a posted sale."},
 proforma:{title:"Proforma Invoice",what:"A preliminary sales document that does not post an accounting invoice.",how:"Create it through the existing Sales transaction workflow.",why:"It communicates expected items and totals before the final invoice."},
 income:{title:"Other Income",what:"Income outside the normal sale-invoice workflow.",how:"Record it only through available SalesPunch360 accounting workflows and permissions.",why:"Separate classification supports accurate reporting."},
 orders:{title:"Sale / Purchase Order",what:"Orders record an intention to sell or buy before billing.",how:"Use the existing Sales Order or Purchase Order transaction flows when enabled.",why:"Orders help track commitments without prematurely posting an invoice or bill."},
 assets:{title:"Fixed Assets (FA)",what:"Long-term business assets tracked by SalesPunch360 accounting.",how:"Use the existing Assets module according to your role and module access.",why:"Separate asset records support accurate balance-sheet reporting."},
 challan:{title:"Delivery Challan",what:"A document for goods dispatched without creating a sale invoice at that time.",how:"Use the existing Delivery Challan workflow when enabled.",why:"It records the movement and delivery of goods before final billing where applicable."},
 returnChallan:{title:"Goods Return on Delivery Challan",what:"Records goods returned against a delivery movement.",how:"This separate option is not currently supported; use only existing validated return workflows.",why:"Avoiding unsupported shortcuts protects stock accuracy."},
 printChallan:{title:"Print Amount on Challan",what:"Would control whether monetary amounts appear on a delivery challan printout.",how:"A separate control is not currently supported by the print-template architecture.",why:"SalesPunch360 does not show a functional toggle until the print workflow supports it safely."},
};
function InfoButton({topic,onOpen}:{topic:keyof typeof INFO;onOpen:(info:Info)=>void}){return <button className="settings-info" type="button" aria-label={`About ${INFO[topic].title}`} onClick={event=>{event.preventDefault();event.stopPropagation();onOpen(INFO[topic])}}>i</button>}
function InfoDialog({info,onClose}:{info:Info|null;onClose:()=>void}){const ok=useRef<HTMLButtonElement>(null);useEffect(()=>{if(!info)return;ok.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[info,onClose]);if(!info)return null;return <div className="settings-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="settings-info-modal" role="dialog" aria-modal="true" aria-labelledby="settings-info-title"><h2 id="settings-info-title">{info.title}</h2><h3>What is this?</h3><p>{info.what}</p>{info.how&&<><h3>How it is used?</h3><p>{info.how}</p></>}{info.why&&<><h3>Why to use?</h3><p>{info.why}</p></>}<button ref={ok} type="button" className="account-primary" onClick={onClose}>OK</button></section></div>}
const availableFeatures=[
 ["Estimate / Quotation","estimate",true],["Proforma Invoice","proforma",true],["Other Income","income",false],["Sale / Purchase Order","orders",true],["Fixed Assets","assets",true],["Delivery Challan","challan",true],["Goods Return on Delivery Challan","returnChallan",false],["Print Amount on Challan","printChallan",false],
] as const;
export function GeneralSettingsForm({values}:{values:Values}){
 const[dirty,setDirty]=useState(false),[decimals,setDecimals]=useState(Math.min(4,Math.max(0,values.displayDecimalPlaces))),[info,setInfo]=useState<Info|null>(null);
 useEffect(()=>{if(!dirty||!values.warnUnsavedChanges)return;const warn=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty,values.warnUnsavedChanges]);
 const row=(label:React.ReactNode,control:React.ReactNode)=><div className="general-settings-row"><span>{label}</span><div className="general-settings-control">{control}</div></div>;
 return <><form action={updateGeneralSettingsAction} className="general-settings-form" onChange={()=>setDirty(true)} onSubmit={()=>setDirty(false)}>
  <h2>APPLICATION</h2>
  {row("App Language",<select name="appLanguage" defaultValue={values.appLanguage} aria-label="App Language"><option value="en">English</option><option value="hi">Hindi</option></select>)}
  {row(<span>Business Currency <InfoButton topic="currency" onOpen={setInfo}/></span>,<select name="baseCurrency" defaultValue={values.baseCurrency} aria-label="Business Currency">{["INR","USD","EUR","GBP","AED"].map(x=><option key={x}>{x}</option>)}</select>)}
  {row(<span>Decimal Places <InfoButton topic="decimals" onOpen={setInfo}/></span>,<div className="settings-stepper"><button type="button" aria-label="Decrease decimal places" disabled={decimals===0} onClick={()=>{setDecimals(x=>Math.max(0,x-1));setDirty(true)}}>−</button><output aria-live="polite">{decimals}</output><input type="hidden" name="displayDecimalPlaces" value={decimals}/><button type="button" aria-label="Increase decimal places" disabled={decimals===4} onClick={()=>{setDecimals(x=>Math.min(4,x+1));setDirty(true)}}>+</button></div>)}
  {row("Date Format",<select name="dateFormat" defaultValue={values.dateFormat} aria-label="Date Format"><option value="DD/MM/YYYY">dd/MM/yyyy</option><option value="MM/DD/YYYY">MM/dd/yyyy</option><option value="YYYY-MM-DD">yyyy-MM-dd</option></select>)}
  {row(<span>Theme <InfoButton topic="theme" onOpen={setInfo}/></span>,<select name="appearance" defaultValue="STANDARD" aria-label="Theme"><option value="STANDARD">Standard</option><option disabled>Trending — Coming Soon</option><option disabled>Modern — Coming Soon</option></select>)}
  <input type="hidden" name="warnUnsavedChanges" value={values.warnUnsavedChanges?"on":""}/>
  <h2>SECURITY</h2>
  {row(<span>Passcode / Fingerprint <InfoButton topic="security" onOpen={setInfo}/></span>,<small>Not available on Web</small>)}
  <h2>BUSINESS &amp; DATA</h2>
  <Link className="general-settings-row navigates" href="/workspace/account/settings/multi-branch"><span>Multi-Branch Settings <InfoButton topic="branches" onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
  <Link className="general-settings-row navigates" href="/workspace/account/inventory/warehouses"><span>Godown / Warehouse &amp; Stock Transfer <InfoButton topic="warehouse" onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
  <Link className="general-settings-row navigates" href="/workspace/account/settings/backup"><span>Backup Settings <InfoButton topic="backup" onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
  <h2>MORE TRANSACTIONS</h2>
  {availableFeatures.map(([label,topic,supported])=>row(<span>{label} <InfoButton topic={topic} onOpen={setInfo}/></span>,<label className="settings-feature-state"><input type="checkbox" checked={supported} disabled aria-label={`${label} ${supported?"available":"not available"}`}/><span>{supported?"Available":"Not available"}</span></label>))}
  <div className="general-settings-save"><button className="account-primary">Save General Settings</button>{dirty&&<small role="status">Unsaved changes</small>}</div>
 </form><InfoDialog info={info} onClose={()=>setInfo(null)}/></>;
}
