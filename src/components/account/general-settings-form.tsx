"use client";
import {AccountText,useAccountLabel} from "./display-preferences";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {updateGeneralSettingsAction} from "@/app/actions/account-settings";
import {SaveFeedbackForm,SaveSubmitButton,SavePendingFields} from "./save-feedback";

type Values={appLanguage:string;baseCurrency:string;displayDecimalPlaces:number;dateFormat:string;warnUnsavedChanges:boolean;appearance:string;fixedAssetsEnabled:boolean};
type Info={title:string;what:string;how?:string;why?:string};
const INFO:Record<string,Info>={
 currency:{title:"Business Currency",what:"Selects the primary currency for this SalesPunch360 business.",how:"Its code and symbol are used on applicable Sales, Purchase, Expense, accounting and report screens.",why:"A consistent business currency keeps records and reports comparable."},
 decimals:{title:"Decimal Places",what:"Controls how many digits SalesPunch360 displays after the decimal point.",how:"Monetary values follow this display preference. Item quantity precision is controlled in Item Settings.",why:"It changes presentation only; stored accounting values and calculation precision are not reduced."},
 theme:{title:"Theme",what:"Controls the visual style of SalesPunch360.",how:"Standard is the current and only available theme. Trending and Modern are planned for a later release.",why:"Future themes will offer alternative presentation without changing business records."},
 security:{title:"Passcode / Fingerprint",what:"App security helps prevent unauthorized access to business information.",how:"SalesPunch360 currently protects this Web workspace with your authenticated account and password. A separate app passcode or biometric lock is not available here.",why:"Use a strong password and secure your device while platform-specific protection is unavailable."},
 branches:{title:"Multi-Branch",what:"Multi-Branch uses SalesPunch360’s existing company branches—never a separate firm record.",how:"Authorized users can manage branches and work within their permitted branch scope.",why:"It keeps inventory, transactions and reports isolated or consolidated according to existing permissions."},
 warehouse:{title:"Godown / Warehouse & Stock Transfer",what:"Uses the existing SalesPunch360 warehouse and inventory-transfer workflow.",how:"Open it to manage warehouses and validated transfers without creating duplicate stock movements.",why:"Using the existing workflow preserves inventory and accounting controls."},
 backup:{title:"Backup Settings",what:"SalesPunch360 provides manual and scheduled private master-data backup bundles.",how:"Open Backup Settings to configure the interval or generate a checksum-protected export.",why:"The export complements—but does not replace—your hosting provider’s tested database backups."},
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
type BrowserNavigation = {
 addEventListener(type:"navigate", listener:(event:Event & {destination:{url:string}})=>void):void;
 removeEventListener(type:"navigate", listener:(event:Event & {destination:{url:string}})=>void):void;
};
export function GeneralSettingsForm({values}:{values:Values}){
 const translate=useAccountLabel();
 const[warning,setWarning]=useState(values.warnUnsavedChanges);
 const[assetsEnabled,setAssetsEnabled]=useState(values.fixedAssetsEnabled);
 const[dirty,setDirty]=useState(false),[decimals,setDecimals]=useState(Math.min(4,Math.max(0,values.displayDecimalPlaces))),[info,setInfo]=useState<Info|null>(null);
 useEffect(()=>{
  if(!dirty||!warning)return;
  const confirmLeave=()=>window.confirm(translate("Leave General Settings without saving your changes?"));
  let confirmedDestination:string|null=null;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};
  const navigation=(window as Window & {navigation?:BrowserNavigation}).navigation;
  const navigate=(event:Event & {destination:{url:string}})=>{
   if(event.destination.url===confirmedDestination){confirmedDestination=null;return;}
   if(event.cancelable&&event.destination.url!==window.location.href&&!confirmLeave())event.preventDefault();
  };
  // Intercept links before Next can change its route state. The Navigation
  // API adds cancellable browser history protection without duplicate prompts.
  const click=(event:MouseEvent)=>{const link=(event.target as Element).closest?.("a[href]");if((event.target as Element).closest?.("button")||!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const href=link.getAttribute("href");if(!href||href.startsWith("#")||link.getAttribute("target")==="_blank")return;if(!confirmLeave()){event.preventDefault();event.stopPropagation()}else confirmedDestination=new URL(href,window.location.href).href};
  window.addEventListener("beforeunload",warn);
  navigation?.addEventListener("navigate",navigate);document.addEventListener("click",click,true);
  return()=>{window.removeEventListener("beforeunload",warn);navigation?.removeEventListener("navigate",navigate);document.removeEventListener("click",click,true)};
 },[dirty,warning,translate]);
 const row=(label:React.ReactNode,control:React.ReactNode,key?:string)=><div key={key} className="general-settings-row"><span>{typeof label==="string"?translate(label):label}</span><div className="general-settings-control"><SavePendingFields>{control}</SavePendingFields></div></div>;
 return <><SaveFeedbackForm action={updateGeneralSettingsAction} errorMessages={{BUSINESS_CURRENCY_LOCKED:"Business currency cannot be changed after accounting entries have been posted."}} className="general-settings-form" onChange={()=>setDirty(true)} onSuccess={()=>setDirty(false)}>
  <h2><AccountText>APPLICATION</AccountText></h2>
  {row("App Language",<select name="appLanguage" defaultValue={values.appLanguage} aria-label="App Language"><option value="en">English</option><option value="hi">Hindi</option></select>)}
  {row(<span><AccountText>Business Currency</AccountText> <InfoButton topic="currency" onOpen={setInfo}/></span>,<select name="baseCurrency" defaultValue={values.baseCurrency} aria-label="Business Currency">{["INR","USD","EUR","GBP","AED"].map(x=><option key={x}>{x}</option>)}</select>)}
  {row(<span><AccountText>Decimal Places</AccountText> <InfoButton topic="decimals" onOpen={setInfo}/></span>,<div className="settings-stepper"><button type="button" aria-label="Decrease decimal places" disabled={decimals===0} onClick={()=>{setDecimals(x=>Math.max(0,x-1));setDirty(true)}}>−</button><output aria-live="polite">{decimals}</output><input type="hidden" name="displayDecimalPlaces" value={decimals}/><button type="button" aria-label="Increase decimal places" disabled={decimals===4} onClick={()=>{setDecimals(x=>Math.min(4,x+1));setDirty(true)}}>+</button></div>)}
  {row("Date Format",<select name="dateFormat" defaultValue={values.dateFormat} aria-label="Date Format"><option value="DD/MM/YYYY">dd/MM/yyyy</option><option value="MM/DD/YYYY">MM/dd/yyyy</option><option value="YYYY-MM-DD">yyyy-MM-dd</option></select>)}
  {row(<span><AccountText>Theme</AccountText> <InfoButton topic="theme" onOpen={setInfo}/></span>,<select name="appearance" defaultValue="STANDARD" aria-label="Theme"><option value="STANDARD">Standard</option><option disabled>Trending — Coming Soon</option><option disabled>Modern — Coming Soon</option></select>)}
  {row("Show warning for unsaved changes",<input type="checkbox" name="warnUnsavedChanges" checked={warning} onChange={event=>setWarning(event.target.checked)} aria-label="Show warning for unsaved changes"/>)}
  <h2><AccountText>SECURITY</AccountText></h2>
  {row(<span><AccountText>Passcode / Fingerprint</AccountText> <InfoButton topic="security" onOpen={setInfo}/></span>,<small><AccountText>Not available on Web</AccountText></small>)}
  <h2><AccountText>BUSINESS &amp; DATA</AccountText></h2>
  <Link className="general-settings-row navigates" href="/workspace/account/settings/multi-branch"><span><AccountText>Multi-Branch Settings</AccountText> <InfoButton topic="branches" onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
  <Link className="general-settings-row navigates" href="/workspace/account/inventory/warehouses"><span><AccountText>Godown / Warehouse &amp; Stock Transfer</AccountText> <InfoButton topic="warehouse" onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
  <Link className="general-settings-row navigates" href="/workspace/account/settings/backup"><span><AccountText>Backup Settings</AccountText> <InfoButton topic="backup" onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
  <h2><AccountText>MORE TRANSACTIONS</AccountText></h2>
  {availableFeatures.map(([label,topic,supported])=>row(<span>{translate(label)} <InfoButton topic={topic} onOpen={setInfo}/></span>,<label className="settings-feature-state"><input type="checkbox" name={topic==="assets"?"fixedAssetsEnabled":undefined} checked={topic==="assets"?assetsEnabled:supported} disabled={topic!=="assets"} onChange={e=>{setAssetsEnabled(e.target.checked);setDirty(true)}} aria-label={label}/><span>{topic==="assets"?translate(assetsEnabled?"On":"Off"):translate(supported?"Available":"Not available")}</span></label>,label))}
  <div className="general-settings-save"><SaveSubmitButton className="account-primary"><AccountText>Save General Settings</AccountText></SaveSubmitButton>{dirty&&<small role="status"><AccountText>Unsaved changes</AccountText></small>}</div>
 </SaveFeedbackForm><InfoDialog info={info} onClose={()=>setInfo(null)}/></>;
}
