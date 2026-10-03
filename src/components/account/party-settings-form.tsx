"use client";
import Link from "next/link";
import {useState} from "react";
import {updatePartySettingsAction} from "@/app/actions/party-settings";
import {SettingsInfoButton,SettingsInfoDialog,type SettingsInfo} from "./settings-info-dialog";
import {AccountSaveForm,AccountSubmitButton} from "./account-save-form";
import type {PartySettings} from "@/lib/account/party-settings";

export const PARTY_INFO={gstin:{title:"GSTIN Number",what:"You can enter GSTIN/TIN/VATIN of a party while adding or editing the party. This number can be printed on invoices issued to that party.",why:"Enable this when you want the party’s GSTIN/TIN/VATIN number to be stored and shown on supported invoices."},grouping:{title:"Party Grouping",what:"Group similar types of parties together and assign parties to those groups.",why:"Useful when you want groups such as Customers, Vendors, region-wise customers, or other business-specific groups and want reports or filtering based on those groups."},additional:{title:"Party Additional Fields",what:"Add extra fields to save more information for parties.",why:"Use this when you need to enter and track additional party-level information specific to your business."},shipping:{title:"Party Shipping Address",what:"Enables you to add a separate shipping address for the party.",why:"Useful when a party’s billing address is different from the shipping address so deliveries go to the correct location."},printShipping:{title:"Print Shipping Address",what:"Enables you to print the party’s shipping address on supported invoices and bills.",why:"Useful when the billing and shipping addresses are different and the delivery document should clearly show the shipping destination."},loyalty:{title:"Loyalty Points",status:"Coming Soon",what:"Loyalty Points will allow customers to earn points on eligible purchases and use them for discounts on later purchases.",why:"A loyalty program can encourage repeat purchases and reward returning customers."}} satisfies Record<string,SettingsInfo>;

export function PartySettingsForm({values}:{values:PartySettings}){
 const[shipping,setShipping]=useState(values.shippingAddressEnabled),[info,setInfo]=useState<SettingsInfo|null>(null);
 const toggle=(name:string,label:string,checked:boolean,disabled=false,detail?:string)=><div className={`general-settings-row${disabled?" disabled":""}`}><span><strong>{label}</strong>{detail&&<small>{detail}</small>} <SettingsInfoButton info={PARTY_INFO[name as keyof typeof PARTY_INFO]} onOpen={setInfo}/></span><input name={name==="gstin"?"gstinEnabled":name==="grouping"?"groupingEnabled":name==="shipping"?"shippingAddressEnabled":"printShippingAddress"} type="checkbox" className="settings-switch" defaultChecked={checked} disabled={disabled} onChange={name==="shipping"?event=>setShipping(event.target.checked):undefined} aria-label={label}/></div>;
 return <>
  <AccountSaveForm action={updatePartySettingsAction} className="party-settings-form" successMessage="Party settings saved successfully">
   {toggle("gstin","GSTIN Number",values.gstinEnabled)}
   {toggle("grouping","Party Grouping",values.groupingEnabled,false,"Canonical grouping controls will appear where supported.")}
   <Link className="general-settings-row navigates" href="/workspace/account/settings/party/additional-fields"><span><strong>Party Additional Fields</strong> <SettingsInfoButton info={PARTY_INFO.additional} onOpen={setInfo}/></span><b aria-hidden>›</b></Link>
   {toggle("shipping","Party Shipping Address",shipping)}
   {toggle("printShipping","Print Shipping Address",values.printShippingAddress,!shipping,!shipping?"Enable Party Shipping Address first.":undefined)}
   {toggle("loyalty","Loyalty Points",false,true,"Coming Soon")}
   <div className="settings-sticky-actions"><Link href="/workspace/account/settings">Cancel</Link><AccountSubmitButton className="account-primary">Save</AccountSubmitButton></div>
  </AccountSaveForm>
  <SettingsInfoDialog info={info} onClose={()=>setInfo(null)}/>
 </>;
}
